module.exports = function (RED) {
  'use strict'

  function WhatsappStart(config) {

    RED.nodes.createNode(this, config);
    var globalSession = this.context().global;
    // globalSession.set("globalSession", config);
    // console.log(globalSession.get("globalSession"));
    this.client = config.client;
    var node = this;
    async function clientStateChange(node, start) {

      const clientNode = RED.nodes.getNode(node.client);
      // Set node status
      function setStatus(type, message) {
        const types = { info: 'blue', error: 'red', warning: 'yellow', success: 'green' }
        node.status({
          fill: types[type] || 'grey',
          shape: 'dot',
          text: message
        })
      }

      function registerEvents() {
        clientNode.on('stateChange', onStateChange.bind(node))
      }

      function onStateChange(socketState) {
        setStatus(SOCKETS_STATE[socketState], 'Socket: ' + socketState)
      }

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

            node.session = client
          })

          registerEvents()
          return node.client

        } else {
          clientNode.close();
          setStatus('error', 'Client disconnected')
        }
      }
    }

    node.on("input", function (msg) {

      if (msg.whatsapp === "start") {
        console.log(node);
        console.log(msg)
        clientStateChange(node, true);
      } else if (msg.whatsapp === "stop") {
        clientStateChange(node, false);
      }

    });

  }

  RED.nodes.registerType('whatsapp-start', WhatsappStart)

  // RED.httpAdmin.post("/whatsapp-start/:id", RED.auth.needsPermission("whatsapp-start.write"), async function (req, res) {

  //   var node = RED.nodes.getNode(req.params.id);
  //   var globalSession = node.context().global
  //   // console.log(globalStuff.get("globalSession"));
  //   var clientNode = RED.nodes.getNode(globalSession.get("globalSession").client);
  //   node.client = clientNode;
  //   var active = req.body.active === 'false' ? false : true;
  //   if (node != null) {
  //     try {
  //       if (!active) {
  //         node.receive()
  //         clientNode.close();
  //         clientNode.setNull();
  //       } else {
  //         node.receive();
  //         console.log("Reached here")
  //         await clientStateChange(node, active);
  //         console.log("didn't fail")
  //       }
  //       res.sendStatus(200);
  //     } catch (err) {
  //       res.sendStatus(500);
  //       node.error(RED._("whatsapp-start.failed", { error: err.toString() }));
  //     }
  //   } else {
  //     res.sendStatus(404);
  //   }
  // });
}
