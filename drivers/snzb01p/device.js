'use strict';

const Homey = require('homey');
const BaseDevice = require('../../lib/base/BaseDevice'); // Import the BaseDevice

module.exports = class SNZB01PDevice extends BaseDevice {

    /**
     * Handle WebSocket messages.
     * @param {object} msg The WebSocket message.
     */
    async onWebSocketMessage(msg) {
        try {
            if (msg && msg.action === 'update') {
                const { deviceid, params } = msg;
                if (deviceid === this.getData().id) {
                    if (params.key !== undefined) {
                        switch (params.key) {
                            case 0:
                                this.log('Key is 0 - single press');

                                this.driver.singlePressTrigger(this);
                                break;
                            case 1:
                                this.log('Key is 1 - double press');

                                this.driver.doublePressTrigger(this);
                                break;
                            case 2:
                                this.log('Key is 2 - long press');

                                this.driver.longPressTrigger(this);
                                break;
                            default:
                                this.log('Key has an unexpected value:', params.key);
                                // Handle unexpected key values
                                break;
                        }
                    }

                    await this.updateDeviceSettings(params);
                }
            }
        } catch (error) {
            this.error('Error handling WebSocket message:', error);
        }
    }



};