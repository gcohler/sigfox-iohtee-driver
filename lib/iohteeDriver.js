'use strict';

const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline
const EventEmitter = require('events');
const constants = require('./constants.js');

const READY_TIMEOUT = 2000;

const debug = (str) => {
  if(process.env.DEBUG != 1) return;
  console.log(str);
};

class Driver extends EventEmitter {

  constructor(portName) {
    super();
    if(!portName) {
      throw new Error('Portname is required!');
    }
    this._portName = portName;
    const port = new SerialPort(portName);
    const parser = new Readline();
    port.pipe(parser)
    this._serial = port;
    this._parser = parser;
    this._handlePortOpen();
    this._serial.on('error', (...args) => this.emit('error', ...args));
  }

  static get constants() { return constants; }

  _handlePortOpen() {
    this._ready = new Promise((resolve, reject) => {
      const onPortOpen = () => {
        this._serial.removeListener('open', onPortOpen);
        resolve();
        debug(`Port ${this._portName} is now open`);
      }
      this._serial.on('open', onPortOpen);
    });
  }

  waitPortReady() {
    return new Promise((resolve, reject) => {
      let timedout = false;
      let timeout = setTimeout(() => {
        timedout = true;
        reject(new Error('port ready timeout'));
      }, READY_TIMEOUT);
      this._ready.then(() => {
        if(timedout) return;
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  _waitDataReceive(successReply, errorReply, timeout) {
    return new Promise((resolve, reject) => {
      let done = false;
      let dataHistory = [];
      let timer = setTimeout(() => {
        this._parser.removeListener('data', dataHandler);
        if (successReply) {
          reject(new Error('timeout'));
        }
        else {
          resolve(dataHistory)
        }
        done = 'Timed Out';
      }, timeout);
      const dataHandler = (data) => {
        data = data.replace(/\r/g, "").replace(/\n/g, "");
        debug(`Received => '${data}'`);
        dataHistory.push(data);
        if(!done) {
          if (successReply && data.match(successReply)) {
            done = 'Success';
          }
          else if (data.match(errorReply)) {
            done = 'Error';
          }
        }
        if(done) {
          clearTimeout(timer);
          this._parser.removeListener('data', dataHandler);
          switch (done) {
            case 'Success':   resolve(dataHistory); break;
            case 'Error':     reject(new Error(`Received (${errorReply})`)); break;
          }
        }
      }
      this._parser.on('data', dataHandler);
    });
  }

  _writeAndDrain(dataToWrite) {
    return this.waitPortReady()
    .then(() => {
      return new Promise((resolve, reject) => {
        this._serial.write(dataToWrite, (error) => {
          if(error) return reject(error);
          this._serial.drain((error) => error ? reject(err) : resolve());
        });
      })
    });
  }

  _commandSend(hexStr, successReply = 'OK', errorReply = 'ERROR', timeout = 5000) {
    debug(`Sending ${hexStr}`);
    this._writeAndDrain(hexStr + '\r')
    .catch(console.error.bind(console));
    // don't wait the previous promise to listen to data, otherwise we can miss them
    return this._waitDataReceive(successReply, errorReply, timeout);
  }

  checkModuleIsAlive() {
    return this._commandSend('AT')
    .then((dataHistory) => {
      debug("Module is responding");
      return dataHistory[0];
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      const onPortClose = () => {
        debug(`Port ${this._portName} is now closed`);
        this._ready = false;
        resolve();
      }
      this._serial.on('close', onPortClose);
      this._serial.close();
    })
  }

  sendBytes(buffer) {
    return Promise.resolve().then(() => {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('A buffer is required');
      }
      if (buffer.length < 1) {
        throw new Error('Buffer minimum length is 1 byte');
      }
      if (buffer.length > 12) {
        throw new Error('Buffer maximum length is 12 bytes');
      }
      return this.getModuleRadioInformation()
      .then((radioInfo) => {
        if (radioInfo.x === 0 || radioInfo.y < 3) {
          return this._commandSend('AT$RC')
        }
      }).then(() => {
        return this._commandSend(`AT$SF=${buffer.toString('hex')}`, 'OK', 'ERROR', 10000)
      }).then(() => {
        return buffer.length;  // return number of bytes sent
      });
    });
  }

  getModuleInformation(informationCode) {
    return this._commandSend(`AT\$I=${informationCode}`, false, 'ERROR', 250)
    .then((dataHistory) => {
      return dataHistory[0];
    });
  }

  getModuleRadioInformation() {
    return this._commandSend('AT$GI?', false, 'ERROR', 250)
    .then((dataHistory) => {
      const radioInfo = {
        x: parseInt(dataHistory[0].split(',')[0]),
        y: parseInt(dataHistory[0].split(',')[1]),
      };
      debug(`radioInfo is ${JSON.stringify(radioInfo)}`);
      return radioInfo;
    });
  }

  getModuleTemperature() {
    return this._commandSend('AT$T?', false, 'ERROR', 250)
    .then((dataHistory) => {
      return dataHistory[0];
    });
  }

  getModuleVoltages() {
    return this._commandSend('AT$V?', false, 'ERROR', 250)
    .then((dataHistory) => {
      return dataHistory
    });
  }

  getModuleMetadata(results, index) {
    return Promise.resolve().then(() => {
      results = results || {};
      if (index === undefined || index < 0) {
        index = 0
      }
      const numKeys = Object.keys(constants.COMMAND.ATI).length;
      if (index >= numKeys + 2) {
        return results;
      }
      if (index === numKeys) {
        return this.getModuleTemperature()
        .then((temp) => {
          results.moduleTemperature = temp;
          return this.getModuleMetadata(results, index + 1);
        })
      }
      if (index === numKeys + 1) {
        return this.getModuleVoltages()
        .then((vs) => {
          results.moduleVoltages = vs;
          return this.getModuleMetadata(results, index + 1);
        })
      }
      const code = Object.keys(constants.COMMAND.ATI)[index];
      return this.getModuleInformation(constants.COMMAND.ATI[code])
      .then((res) => {
        results[code] = res;
        return this.getModuleMetadata(results, index + 1)
      })
    })
  }
}

module.exports = Driver;
