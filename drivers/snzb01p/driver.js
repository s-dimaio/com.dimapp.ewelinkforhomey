'use strict';

const Homey = require('homey');
const BaseDriver = require('../../lib/base/BaseDriver'); // Import the BaseDriver

const productModel = [
  "SNZB-01P",
  // "ZCL_HA_DEVICEID_ON_OFF_LIGHT",
  // "ZBMINIR2"
];

module.exports = class SNZB01PDriver extends BaseDriver {

  singlePressTrigger(device) {
    this._singlePressTrigger.trigger(device);
  }

  doublePressTrigger(device) {
    this._doublePressTrigger.trigger(device);
  }

  longPressTrigger(device) {
    this._longPressTrigger.trigger(device);
  }


  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    super.onInit();

    this._singlePressTrigger = this.homey.flow.getDeviceTriggerCard("single-press");
    this._doublePressTrigger = this.homey.flow.getDeviceTriggerCard("double-press");
    this._longPressTrigger = this.homey.flow.getDeviceTriggerCard("long-press");
  }

  onPair(session) {
    super.onPair(session);

    session.setHandler("list_devices", async () => {
      this.log('onPair - ListDevices called');

      try {
        const deviceList = await this.app.eWeLinkConnect.getDeviceList();
        const filteredDeviceList = deviceList.filter(device => productModel.includes(device.productModel));
        this.log('Device list:', JSON.stringify(filteredDeviceList, null, 2));

        return filteredDeviceList.map(device => {
          return {
            name: device.name,
            data: {
              id: device.id,
            },
            store: {
              online: device.online
            },
            settings: {
              subDevRssi: device.params.subDevRssi,
              brandName: device.brandName,
              productModel: device.productModel,
              idDevice: device.id,
              fwVersion: device.params.fwVersion
            }
          };
        });

      } catch (error) {
        this.error('Error initializing client:', error);

        return [];
      }
    });
  }

};
