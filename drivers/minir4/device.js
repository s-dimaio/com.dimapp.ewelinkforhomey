'use strict';

const Homey = require('homey');
const BaseDevice = require('../../lib/base/BaseDevice'); // Import the BaseDevice

module.exports = class MiniR4Device extends BaseDevice {


  async onInit() {
    super.onInit();

    this.registerCapabilityListener("onoff", async (value) => {
      try {
        this.log('onoff capability changed to:', value);

        const status = {
          switches: [
            {
              outlet: 0,
              switch: value ? 'on' : 'off'
            }
          ]
        };

        await this.app.eWeLinkConnect.setDeviceStatus(this.getData().id, status);
      } catch (error) {
        this.error('Failed to set device status:', error);
      }
    });
  }

    /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event The onSettings event data.
   * @param {object} event.oldSettings The old settings object.
   * @param {object} event.newSettings The new settings object.
   * @param {string[]} event.changedKeys An array of keys changed since the previous version.
   * @returns {Promise<string|void>} Return a custom message that will be displayed.
   */
    async onSettings({ oldSettings, newSettings, changedKeys }) {
      this.log('MyDevice settings were changed:', changedKeys, 'old:', oldSettings, 'new:', newSettings);
  
      for (const k of changedKeys) {
        try {
          let status;
          switch (k) {
            case 'startup':
            case 'enableDelay':
            case 'widthDelay':
              status = {
                configure: [
                  {
                    startup: newSettings.startup ?? 'off',
                    enableDelay: newSettings.enableDelay ? 1 : 0,
                    width: newSettings.widthDelay * 1000,
                    outlet: 0
                  }
                ]
              };
              break;
            case 'swMode':
            case 'swCtrlReverse':
              status = {
                swMode: parseInt(newSettings.swMode, 10),
                swCtrlReverse: newSettings.swCtrlReverse ? 'on' : 'off'
              };
              break;
            case 'relaySeparation':
              status = { relaySeparation: newSettings.relaySeparation ? 1 : 0 };
              break;
            case 'sledOnline':
              status = { sledOnline: newSettings.sledOnline ? 'on' : 'off' };
              break;
            case 'pulse':
            case 'widthInching':
            case 'switchInching':
              status = {
                pulses: [
                  {
                    pulse: newSettings.pulse ? 'on' : 'off',
                    switch: newSettings.switchInching ? 'on' : 'off',
                    width: newSettings.widthInching * 1000,
                    outlet: 0
                  }
                ]
              };
              break;
            default:
              status = { [k]: newSettings[k] };
          }
  
          this.log(`Setting ${k} to: ${newSettings[k]} - status:`, status);
          this.updatingFromApp = true;
          await this.app.eWeLinkConnect.setDeviceStatus(this.getData().id, status);
          this.homey.setTimeout(() => {
            this.updatingFromApp = false;
          }, 5000); // Reset the flag after 5 seconds
        } catch (error) {
          this.error(`Failed to set ${k} to ${newSettings[k]}:`, error);
          this.updatingFromApp = false; // Reset the flag in case of error
        }
      }
    }
};
