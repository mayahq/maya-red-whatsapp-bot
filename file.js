module.exports = function (RED) {
    'use strict'
  
    function WhatsappFile (config) {
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
        DEPRECATED_VERSION: 'error'
      }
      var globalSession = this.context().global
      const clientNode = RED.nodes.getNode(globalSession.get("globalSession").client)
  
      function registerEvents () {
        clientNode.on('stateChange', onStateChange.bind(node))
        clientNode.on('clientEvent', onClientEvent.bind(node))
      }
  
      function onStateChange (socketState) {
        setStatus(SOCKETS_STATE[socketState], 'Socket: ' + socketState)
      }
  
      function onClientEvent (eventName, ...args) {
        node.send({ topic: eventName, payload: args })
      }
  
      function onChatEvent (event, chatId, ...args) {
        node.send({ topic: event, chatId: chatId, args: args })
      }
  
      if (clientNode) {
        clientNode.register(node, null)
  
        setStatus('warning', 'Authenticating...')
  
        clientNode.on('qrCode', function (qrCode) {
          node.send({ topic: 'qrCode', payload: [qrCode] })
        })
  
        clientNode.on('ready', function (client) {
          setStatus('success', 'Connected')
  
          node.client = client
        })
  
        registerEvents()
      }
  
      node.on('input', function (msg) {
  
        if (msg.topic === 'restart') {
          setStatus('warning', 'Authenticating...')
          clientNode.restart()
            .then(() => node.send({ topic: msg.topic, origin: msg, payload: [true] }))
            .catch((err) => node.error('Error while restarting client ' + err.message))
          return
        }
  
        if (!node.client) {
          setStatus('error', 'Client not connected')
          return
        }
  
        if (typeof node.client[msg.topic] === 'function') {
          if (msg.topic === 'onParticipantsChanged' || msg.topic === 'onLiveLocation') {
            const chatId = msg.payload[0]
            // register for chat event
            node.client[msg.topic](chatId, onChatEvent.bind(node, msg.topic, chatId))
          } else if (config.engage){
            node.client["sendFile"](msg.chatId, msg.payload.filepath, msg.payload.filename, msg.payload.caption).then((...args) => {
              node.send({
                topic: "sendFile",
                payload: args,
                origin: msg
              })
            }).catch(err => {
              node.error('Requested api "' + msg.topic + '" ' + err.message)
            })
          }
        } else if(msg.topic === null || msg.topic === ''){
          node.error('Requested api "' + msg.topic + '" doesn\'t exists')
        } else {
            node.send({
                topic: msg.topic,
                payload: msg.payload,
                origin: msg
            })
        }
      })
  
      // Set node status
      function setStatus (type, message) {
        const types = { info: 'blue', error: 'red', warning: 'yellow', success: 'green' }
  
        node.status({
          fill: types[type] || 'grey',
          shape: 'dot',
          text: message
        })
      }
    }
  
    RED.nodes.registerType('whatsapp-file', WhatsappFile)
  }
  