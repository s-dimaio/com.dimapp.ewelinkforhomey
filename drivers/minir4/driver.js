'use strict';

const Homey = require('homey');
const BaseDriver = require('../../lib/base/BaseDriver'); // Import the BaseDriver

const productModel = [
  "MINIR4"
];

module.exports = class MiniR4Driver extends BaseDriver {

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
              enableDelay: device.params?.configure?.[0]?.enableDelay === 1 ? true : false, // --
              widthDelay: (device.params?.configure?.[0]?.width / 1000), // --
              swMode: device.params.swMode.toString(), //--
              swCtrlReverse: device.params.swCtrlReverse === 'on' ? true : false, // --
              startup: device.params?.configure?.[0]?.startup ?? 'off', //-- 
              relaySeparation: device.params.relaySeparation === 1 ? true : false, //--
              sledOnline: device.params.sledOnline === 'on' ? true : false, //--
              pulse: device.params?.pulses?.[0]?.pulse === 'on' ? true : false, // --
              widthInching: device.params?.pulses?.[0]?.width ?? 58, // --
              switchInching: device.params?.pulses?.[0]?.switch ?? 'on', // --
              ssid: device.params.ssid, // --
              brandName: device.brandName, // --
              productModel: device.productModel, // --
              idDevice: device.id, // --
              fwVersion: device.params.fwVersion // --
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
