'use strict';

const Homey = require('homey');

const BaseDriver = require('../../lib/base/BaseDriver'); // Import the BaseDriver

const productModel = [
  // "ZBMINIL2",
  "ZCL_HA_DEVICEID_ON_OFF_LIGHT",
  // "ZBMINIR2"
];

module.exports = class ZBMiniDriver extends BaseDriver {

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
              online: device.online,
            },
            settings: {
              subDevRssi: device.params.subDevRssi,
              brandName: device.brandName,
              productModel: device.productModel,
              idDevice: device.id
            },
            icon: `ic_${device.productModel}.svg`
            };
        });

      } catch (error) {
        this.error('Error initializing client:', error);

        return [];
      }
    });
  }

};
