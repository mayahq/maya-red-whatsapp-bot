module.exports = function (RED) {
    'use strict'

    const { create } = require('sulla')

    const RETRY_TIMEOUT = 10000

    function WhatsappSession(config) {
        RED.nodes.createNode(this, config)
        const node = this

        var client = null

        function registerEvents(n, EVENTS) {
            for (const event of EVENTS) {
                client[event](onEvent.bind(n, event))
            }
        }

        function onEvent(eventName, ...args) {
            node.emit('clientEvent', eventName, ...args)
        }

        function onQrCode(qrCode) {
            node.emit('qrCode', qrCode)
        }

        async function startClient() {
            client = await create(config.session, onQrCode, {
                headless: config.headless,
                devtools: config.devtools
            })

            client.onStateChange((state) => {
                if (state === 'UNLAUNCHED') {
                    client.useHere()
                }

                node.emit('stateChange', state)
            })
            node.emit('ready', client)
        }

        node.on('close', function (done) {
            if (client) {
                client.close
                    .catch((err) => {
                        node.error('Error while closing Whatsapp client "' + config.session + '": ' + err.message)
                    }).finally(() => done())
            } else {
                done()
            }
        })

        // check for registered nodes using configuration
        node.registeredNodeList = {}
        node.sessionNodes = 0

        // trick used to not start client if there are not nodes using this client
        node.register = function (nodeToRegister, events) {
            node.registeredNodeList[nodeToRegister.id] = nodeToRegister
            if (nodeToRegister.type === 'whatsapp-start') {
                console.log("Register Start Node")
                console.log(nodeToRegister)
                startClient()
                    .catch((err) => {
                        node.error('Error while starting Whatsapp client "' + config.session + '": ' + err.message)
                        // retry
                        setTimeout(node.register.bind(node, nodeToRegister, events), RETRY_TIMEOUT)
                    })
            } else if (Object.keys(node.registeredNodeList).length > 1 && events !== null) {
                function registerEventAtClientReady() {
                    if (!client) {
                        setTimeout(registerEventAtClientReady, 2000); 
                        node.emit('Client Not Ready')
                        return;
                    } else {
                        console.log(events)
                        registerEvents(nodeToRegister, events)
                    }
                }
                registerEventAtClientReady();
            }
        }

        node.restart = async function () {
            if (client) {
                await client.close()
                await startClient()
            }
        }
    }

    RED.nodes.registerType('whatsapp-session', WhatsappSession)
}
