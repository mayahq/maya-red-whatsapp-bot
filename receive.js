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
      DEPRECATED_VERSION: 'error'
    }

    const clientNode = RED.nodes.getNode(config.client)

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

    function onChatEvent(event, chatId, ...args) {
      node.send([{ topic: event, chatId: chatId, args: args }, null])
    }

    if (clientNode) {
      clientNode.register(node, ['onMessage'])

      setStatus('warning', 'Authenticating...')

      clientNode.on('qrCode', function (qrCode) {
        node.send([null, { topic: 'qrCode', payload: [qrCode] }])
      })

      clientNode.on('ready', function (client) {
        setStatus('success', 'Connected')
        node.client = client
      })

      registerEvents();
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
        } else {
          node.client[msg.topic](...msg.payload).then((...args) => {
            node.send({
              topic: msg.topic,
              payload: args,
              origin: msg
            })
          }).catch(err => {
            node.error('Requested api "' + msg.topic + '" ' + err.message)
          })
        }
      } else {
        node.error('Requested api "' + msg.topic + '" doesn\'t exists')
      }
    })

    if (!node.client) {
      setStatus('error', 'Client not connected')
      return
    }

  // Set node status
  function setStatus(type, message) {
    const types = { info: 'blue', error: 'red', warning: 'yellow', success: 'green' }

    node.status({
      fill: types[type] || 'grey',
      shape: 'dot',
      text: message
    })
  }
}

RED.nodes.registerType('whatsapp-receive', WhatsappBotReceive)
}
