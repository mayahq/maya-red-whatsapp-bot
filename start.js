module.exports = function (RED) {
    'use strict'
  
    function WhatsappStart (config) {
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
  
    RED.nodes.registerType('whatsapp-start', WhatsappStart)
  }
  