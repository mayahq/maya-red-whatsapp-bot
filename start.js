module.exports = function (RED) {
  'use strict'
  var globalSessionConfigNode = null;

  function WhatsappStart(config) {

    console.log(config)

    RED.nodes.createNode(this, config)
    globalSessionConfigNode = config;

  }

  async function clientStateChange(node, start) {

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
      DISCONNECTED: 'error'
    }

    const clientNode = await RED.nodes.getNode(node.client)
    console.log(clientNode)
    function registerEvents() {
      clientNode.on('stateChange', onStateChange.bind(node))
    }

    function onStateChange(socketState) {
      setStatus(SOCKETS_STATE[socketState], 'Socket: ' + socketState)
    }

    if (clientNode) {
      console.log("Value of start is: ", start);

      if (start) {
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
        return node.client

      } else {
        console.log("trying to close session")
        clientNode.close();
        setStatus('error', 'Client disconnected')
        return globalConfig.client;
      }
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


  RED.nodes.registerType('whatsapp-start', WhatsappStart)

  RED.httpAdmin.post("/whatsapp-start/:id", RED.auth.needsPermission("whatsapp-start.write"), async function (req, res) {

    var node = RED.nodes.getNode(req.params.id);
    node.client = globalSessionConfigNode.client;
    var clientNode = RED.nodes.getNode(globalSessionConfigNode.client);
    var active = req.body.active === 'false' ? false : true;
    if (node != null) {
      try {
        if (!active) {
          node.receive()
          clientNode.close();
          clientNode.setNull();
        } else {
          node.receive();
          await clientStateChange(node, active);
        }
        res.sendStatus(200);
      } catch (err) {
        res.sendStatus(500);
        node.error(RED._("whatsapp-start.failed", { error: err.toString() }));
      }
    } else {
      res.sendStatus(404);
    }
  });
}
