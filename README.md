This npm module provides a simple and minimalist API to interact with Sigfox modules by Iohtee.

This code was originally based on the sigfox-td12xx-driver code (https://github.com/rudylacrete/sigfox-td12xx-driver).  Changes were needed due to the differences in AT commands between the td12xx and the Iohtee.

Notes:

*    Calls to the driver must be in serial.  There is no internal protection against calling two driver driver methods in parallel -- which will not work.

# Installation

```
npm install sigfox-iohtee-driver
```

The module require node.js to be >= 8.10.

# Usage

Basically, you just need to require the module and instanciate the driver with the proper serial port name:

```
const Driver = require('sigfox-iohtee-driver');
const driver = new Driver('/dev/ttyUSB0');

driver.on('error', (error) => {
	console.error(error);
});
```

From there, you're all set if you get no error. All methods writing to the UART port are already checking if the underlying port is up and running, ready to receive and so on. All the bytes drain logic is also handled by the module.
All the provided methods return an ES6 promise so you can chain them with ease:

```
driver.checkModuleIsAlive().then(() => {
  return driver.getModuleMetadata();
}).then((moduleMetadata) => {
  console.log("Module metadata:", moduleMetadata);
  return driver.sendBytes(Buffer.from('Hello World'));
}).then((bytesSent) => {
  console.log('Done', bytesSent, 'bytes sent');
}).catch(console.error.bind(console));
```

## checkModuleIsAlive()

Check if the chip is working by sending a simple `AT` command and checking for the correct reply.

```
driver.checkModuleIsAlive().then(() => {
	// everything is ok
}).catch(console.error.bind(console));
```

## getModuleInformation(code)

Retrieve specific informations from the Sigfox modem. All registered codes are published through the `Driver.constants` static property.

```
driver.getModuleInformation(Driver.constants.COMMAND.ATI.deviceId).then((deviceId) => {
	console.log(deviceId);
}).catch(console.error.bind(console));
```

## getModuleMetadata()

Return all available module specific data.

```
driver.getModuleMetadata().then((moduleMetadata) => {
	console.log(moduleMetadata);
}).catch(console.error.bind(console));
```

## sendBytes(buffer)

Send the given buffer through the Sigfox network through the basic send method (no ack).

```
driver.sendBytes(Buffer.from('Hello World!')).then((bytesSent) => {
	console.log(bytesSent, "bytes sent");
}).catch(console.error.bind(console));
```

# TODO

- ensure parallel calls are handled in the good order with mutexes or something (command queue)
- implement more AT commands
- allow modifying the core options (timeout, ...)

# License

MIT
