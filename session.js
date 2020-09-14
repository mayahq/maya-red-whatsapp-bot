module.exports = function (RED) {
    'use strict'

    const { create, ev } = require('@open-wa/wa-automate');
    const patch = require('./patch');

    const RETRY_TIMEOUT = 10000
    var RETRIES = 0;

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
            ev.on(`qr.${config.session}`, onQrCode)
            client = await create({
                sessionId: config.session,
                headless: config.headless,
                devtools: config.devtools
            });

            patch(client)

            client.onStateChanged((state) => {
                if (state === 'CONFLICT') {
                    client.forceReFocus()
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
        // var registeredNodeType = new Set();
        node.registeredNodeList = {}

        // trick used to not start client if there are not nodes using this client
        node.register = function (nodeToRegister, events) {
            // registeredNodeList.add(nodeToRegister.type);
            // node.registeredNodeTypes = registeredNodeList;
            node.registeredNodeList[nodeToRegister.id] = nodeToRegister;
            if (nodeToRegister.type === 'whatsapp-start') {
                console.log("Register Start Node")
                startClient()
                    .catch((err) => {
                        node.error('Error while starting Whatsapp client "' + config.session + '": ' + err.message)
                        // retry
                        if(RETRIES < 3){
                            RETRIES++;
                            setTimeout(node.register.bind(node, nodeToRegister, events), RETRY_TIMEOUT)
                        } else {
                            RETRIES = 0;
                            node.emit('stateChange', "TIMEOUT");
                        }
                        
                    })
            } else if (events !== null) {
                console.log("subscribing to events ", events)
                console.log("client status: ", client)
                function registerEventAtClientReady() {
                    if (!client) {
                        console.log("trying to register again..", nodeToRegister.type)
                        setTimeout(registerEventAtClientReady, 2000); 
                        // node.emit('error', 'Client Not Ready')
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
                await client.kill()
                await startClient()
            }
        }

        node.close = async function () {
            if(client){
                await client.kill();
                node.emit('stateChange', 'MANUAL_DISCONNECT');
                // registeredNodeType.clear();
            }
        }

        node.setNull = async function () {
            if(client) {
                client = null;
                node.emit('stateChange', 'DISCONNECTED')
            }
        }
    }

    RED.nodes.registerType('whatsapp-session', WhatsappSession)
}
