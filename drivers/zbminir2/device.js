'use strict';

const Homey = require('homey');
const BaseDevice = require('../../lib/base/BaseDevice'); // Import the BaseDevice

module.exports = class ZBMiniR2Device extends BaseDevice {


    async onInit() {
        super.onInit();

        this.registerCapabilityListener("onoff", async (value) => {
            try {
              this.log('onoff capability changed to:', value);
      
              await this.app.eWeLinkConnect.setDeviceStatus(this.getData().id, { switch: value ? 'on' : 'off' });
            } catch (error) {
              this.error('Failed to set device status:', error);
            }
          });
    }


};
