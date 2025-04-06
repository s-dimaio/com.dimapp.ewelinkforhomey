'use strict';

const Homey = require('homey');
const BaseDriver = require('../../lib/base/BaseDriver'); // Import the BaseDriver

const productModel = [
  //"ZBMINIL2",
  // "ZCL_HA_DEVICEID_ON_OFF_LIGHT",
  "ZBMINIR2"
];

module.exports = class ZBMiniR2Driver extends BaseDriver {

  /**
   * onInit is called when the driver is initialized.
   */
  // async onInit() {
  //   super.onInit();

  //   this.log('ZBMiniL2 driver has been initialized');
  // }

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
              enableDelay: device.params.enableDelay === 1 ? true : false,
              widthDelay: (device.params.width / 1000),
              swMode: device.params.swMode.toString(),
              swCtrlReverse: device.params.swCtrlReverse === 'on' ? true : false,
              startup: device.params.startup ?? 'off',
              relaySeparation: device.params.relaySeparation === 1 ? true : false,
              wallPenetration: device.params.wallPenetration,
              sledOnline: device.params.sledOnline === 'on' ? true : false,
              pulse: device.params?.pulses?.[0]?.pulse === 'on' ? true : false,
              widthInching: device.params?.pulses?.[0]?.width ?? 58,
              switchInching: device.params?.pulses?.[0]?.switch ?? 'on',
              subDevRssi: device.params.subDevRssi,
              brandName: device.brandName,
              productModel: device.productModel,
              idDevice: device.id,
              fwVersion: device.params.fwVersion
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
