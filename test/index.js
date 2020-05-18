'use strict';

const expect = require('chai').expect;
const Driver = require('../index.js');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

describe('basic checks', function(done) {
  it('should trigger an error if the portname is not given', function(done) {
    let d;
    try {
      d = new Driver();
    }
    catch(e) {
      expect(e).to.be.instanceOf(Error);
      expect(e.message).to.match(/Portname is required!/);
    };
    expect(d).to.not.exist;
    done();
  });

  it('should trigger an error if the portname does not exist', function(done) {
    let d = new Driver('/dev/deviceLikelyNotExist');
    d.on('error', (e) => {
      expect(e).to.be.instanceOf(Error);
      expect(e.message).to.match(/cannot\s*open/);
      done();
    });
  });
});

describe('core features', () => {
  it('should fail with non-buffer message', () => {
    let driver = new Driver('/dev/ttyUSB0');
    console.log("      Waiting 2 sec for driver to open");
    return setTimeoutPromise(2000).then(() => {
      console.log("      Checking if module is alive");
      return driver.checkModuleIsAlive()
    }).then(() => {
      console.log("      Sending non-buffer message");
      return driver.sendBytes().catch((e) => {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.match(/A buffer is required/);
      });
    }).then(() => {
      return driver.close();
    }).then(() => {
      driver = null;
      console.log("      Waiting 1 sec for gc to clean up");
      return setTimeoutPromise(1000);
    })
  });

  it('should fail with too-short message', () => {
    let driver = new Driver('/dev/ttyUSB0');
    console.log("      Waiting 2 sec for driver to open");
    return setTimeoutPromise(2000).then(() => {
      console.log("      Checking if module is alive");
      return driver.checkModuleIsAlive()
    }).then(() => {
      console.log("      Sending empty buffer message");
      return driver.sendBytes(Buffer.from('')).catch((e) => {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.match(/Buffer minimum length is 1 byte/);
      });
    }).then(() => {
      return driver.close();
    }).then(() => {
      driver = null;
      console.log("      Waiting 1 sec for gc to clean up");
      return setTimeoutPromise(1000);
    })
  });

  it('should fail with too-long message', () => {
    let driver = new Driver('/dev/ttyUSB0');
    console.log("      Waiting 2 sec for driver to open");
    return setTimeoutPromise(2000).then(() => {
      console.log("      Checking if module is alive");
      return driver.checkModuleIsAlive()
    }).then(() => {
      console.log("      Sending overfull buffer message");
      return driver.sendBytes(Buffer.from('this message is way too long')).catch((e) => {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.match(/Buffer maximum length is 12 bytes/);
      });
    }).then(() => {
      return driver.close();
    }).then(() => {
      driver = null;
      console.log("      Waiting 1 sec for gc to clean up");
      return setTimeoutPromise(1000);
    })
  });

  it('should open, be alive, get metadata, send message', () => {
    let driver = new Driver('/dev/ttyUSB0');
    console.log("      Waiting 2 sec for driver to open");
    return setTimeoutPromise(2000).then(() => {
      console.log("      Checking if module is alive");
      return driver.checkModuleIsAlive()
    }).then(() => {
      console.log("      Getting module metadata");
      return driver.getModuleMetadata();
    }).then((metadata) => {
      expect(metadata).to.not.be.empty;
      expect(metadata.deviceId).to.exist;
      console.log("      %s", JSON.stringify(metadata, null, 8));
      console.log("      Sending 'Hello World!' message");
      return driver.sendBytes(Buffer.from('Hello World!'));
    }).then((bytesSent) => {
      expect(bytesSent).to.equal(12);
      return driver.close();
    }).then(() => {
      driver = null;
      console.log("      Waiting 1 sec for gc to clean up");
      return setTimeoutPromise(1000);
    })
  });
});
