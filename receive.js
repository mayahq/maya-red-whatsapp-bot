module.exports = function (RED) {
    'use strict'

    function WhatsappBotReceive(config) {

        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name

        const SOCKETS_STATE = {
            OPENING: 'info',
            PAIRING: 'info',
            UNPAIRED: 'info',
            UNPAIRED_IDLE: 'info',
            CONNECTED: 'success',
            TIMEOUT: 'error',
            CONFLICT: 'error',
            UNLAUNCHED: 'error',
            PROXYBLOCK: 'error',
            TOS_BLOCK: 'error',
            SMB_TOS_BLOCK: 'error',
            DEPRECATED_VERSION: 'error',
            MANUAL_DISCONNECT: 'manual'
        }

        const clientNode = RED.nodes.getNode(config.client)

        function registerEvents(node) {
            clientNode.on('stateChange', onStateChange.bind(node))
            clientNode.on('clientEvent', onClientEvent.bind(node))
        }

        function onStateChange(socketState) {
            setStatus(SOCKETS_STATE[socketState], 'Socket: ' + socketState)
        }

        function onClientEvent(eventName, ...args) {
            node.send({topic: eventName, payload: args})
        }

        function onChatEvent(event, chatId, ...args) {
            node.send([{
                    topic: event,
                    chatId: chatId,
                    args: args
                }, null])
        }

        if (clientNode) {
            setStatus('warning', 'Waiting for whatsapp client...')
            clientNode.on('ready', function (client) {
                clientNode.register(node, ['onMessage'])
                setStatus('success', 'Connected')
                node.client = client
                registerEvents(node);
            })
        }

        node.client.on('onMessage', (message) => {
            return message
        }).then((...args) => {
            node.send({payload: args})
        }).catch(err => {
            node.error('Requested api "' + msg.topic + '" ' + err.message)
        })
        if (! node.client) {
            setStatus('error', 'Client not connected')
            return
        }

        // Set node status
        function setStatus(type, message) {
            console.log(type);
            const types = {
                info: 'blue',
                error: 'red',
                warning: 'yellow',
                success: 'green',
                manual: 'orange'
            }
            if (type === 'manual') {
                const newClientNode = RED.nodes.getNode(config.client)

                console.log("Register after disconnect")
                registerNodeToClient(node, newClientNode);
            }

            node.status({
                fill: types[type] || 'grey',
                shape: 'dot',
                text: message
            })
        }

    }

    RED.nodes.registerType('whatsapp-receive', WhatsappBotReceive)
}
