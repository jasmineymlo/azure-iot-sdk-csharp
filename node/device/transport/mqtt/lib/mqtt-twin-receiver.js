// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var translateError = require('../lib/mqtt-translate-error.js');
var querystring = require('querystring');
var url = require('url');

// $iothub/twin/PATCH/properties/reported/?$rid={request id}&$version={base version}

/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_009: [** The subscribed topic for `response` events shall be '$iothub/twin/res/#' **]** */
var responseTopic = '$iothub/twin/res/#';

/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_019: [** The subscribed topic for post events shall be $iothub/twin/PATCH/properties/desired/# **]** */
var postTopic = '$iothub/twin/PATCH/properties/desired/#';
        
/**
 * @class        module:azure-iot-device-mqtt.MqttTwinReceiver
 * @classdesc    Acts as a receiver for device-twin traffic
 * 
 * @param {Object} config   configuration object
 *
 */
function MqttTwinReceiver(config) {
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_001: [** The `MqttTwinReceiver` constructor shall accept a `config` object **]** */
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_002: [** The `MqttTwinReceiver` constructor shall throw `ReferenceError` if the `config` object is falsy **]** */
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_028: [** The `MqttTwinReceiver` constructor shall throw a `ReferenceError` if the `config` object does not contain a property named `client` **]** */
  if (!config || !config.client) {
    throw new ReferenceError('required parameter is missing');
  }
  this._config = config;
  this._client = config.client;
  EventEmitter.call(this);

  this.on("newListener", this._handleNewListener.bind(this));
  this.on("removeListener", this._handleRemoveListener.bind(this));
}

MqttTwinReceiver.prototype._handleNewListener = function(eventName) {
  var that = this;

  if (eventName === 'response') {
    if (this.listenerCount('response') === 0) {
      this._startListeningIfFirstSubscription();
      /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_003: [** When a listener is added for the `response` event, the appropriate topic shall be asynchronously subscribed to. **]** */
      process.nextTick( function() {
        that._client.subscribe(responseTopic, { qos: 0 }, function(err) {
          if (err) {
            that._handleError(err);
          }else {
            /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_025: [** If the `subscribed` event is subscribed to, a `subscribed` event shall be emitted after an MQTT topic is subscribed to. **]** */
            /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_026: [** When the `subscribed` event is emitted because the response MQTT topic was subscribed, the parameter shall be the string 'response' **]**  */
            that.emit('subscribed','response');
          }
        });
      });
     }
  } 

  else if (eventName === 'post') {
    if (this.listenerCount('post') === 0) {
      this._startListeningIfFirstSubscription();
      /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_018: [** When a listener is added to the post event, the appropriate topic shall be asynchronously subscribed to. **]** */
      process.nextTick( function() {
        that._client.subscribe(postTopic, { qos: 0 }, function(err) {
          if (err) {
            that._handleError(err);
          }else {
            /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_025: [** If the `subscribed` event is subscribed to, a `subscribed` event shall be emitted after an MQTT topic is subscribed to. **]** */
            /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_026: [** When the `subscribed` event is emitted because the response MQTT topic was subscribed, the parameter shall be the string 'response' **]**  */
            that.emit('subscribed','post');
          }
        });
      });
    }
  }
};

MqttTwinReceiver.prototype._handleRemoveListener = function(eventName) {
  var that = this;

  if (eventName === 'response') {
    if (this.listenerCount('response') === 0) {
      this._stopListeningIfLastUnsubscription();
      /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_005: [** When there are no more listeners for the `response` event, the topic should be unsubscribed **]** */
      process.nextTick( function() {
        that._client.unsubscribe(responseTopic, function(err) {
          if (err) {
            that._handleError(err);
          }
        });
      });
    }
  }
        
  else if (eventName === 'post') {
    if (this.listenerCount('post') === 0) {
      this._stopListeningIfLastUnsubscription();
      /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_021: [** When there are no more listeners for the post event, the topic should be unsubscribed. **]** */
      process.nextTick( function() {
        that._client.unsubscribe(postTopic, function(err) {
          if (err) {
            that._handleError(err);
          }
        });
      });
    }
  }
};

MqttTwinReceiver.prototype._startListeningIfFirstSubscription = function() {
  if ((this.listenerCount('response') === 0) && (this.listenerCount('post') === 0)) {
    this._client.on('message', this._onMqttMessage.bind(this));
  }
};

MqttTwinReceiver.prototype._stopListeningIfLastUnsubscription = function() {
  if ((this.listenerCount('response') === 0) && (this.listenerCount('post') === 0)) {
    this._client.removeListener('message', this._onMqttMessage.bind(this));
  }
};

MqttTwinReceiver.prototype._onMqttMessage = function (topic, message) {
  if (topic.indexOf('$iothub/twin/res') === 0) {
    this._onResponseMessage(topic,message);
  } else if (topic.indexOf('$iothub/twin/PATCH') === 0) {
    this._onPostMessage(topic,message);
  }
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_014: [** Any messages received on topics which violate the topic name formatting shall be ignored. **]** */
};


MqttTwinReceiver.prototype._onResponseMessage = function(topic, message){
  var urlObject, path, query;
  
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_014: [** Any messages received on topics which violate the topic name formatting shall be ignored. **]** */
  try {
    urlObject = url.parse(topic);
    path=urlObject.path.split('/');
    query=querystring.parse(urlObject.query);
  } catch(err) {
    return;
  }

/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_006: [** When a `response` event is emitted, the parameter shall be an object which contains `status`, `requestId` and `body` members **]**  */
/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_010: [** The topic which receives the response shall be formatted as '$iothub/twin/res/{status}/?$rid={request id}' **]** */
/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_015: [** the {status} and {request id} fields in the topic name are required. **]** */
/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_016: [** The {status} and {request id} fields in the topic name shall be strings **]** */
/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_017: [** The {status} and {request id} fields in the topic name cannot be zero length. **]** */
  if ((path[0] === '$iothub') &&
      (path[1] === 'twin') &&
      (path[2] === 'res') &&
      (path[3]) &&
      (path[3].toString().length > 0) &&
      (query.$rid) &&
      (query.$rid.toString().length > 0))
  {
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_011: [** The `status` parameter of the `response` event shall be parsed out of the topic name from the {status} field **]** */
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_012: [** The `requestId` parameter of the `response` event shall be parsed out of the topic name from the {request id} field **]** */
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_013: [** The `body` parameter of the `response` event shall be the body of the received MQTT message **]**  */
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_011: [** The `status` parameter of the `response` event shall be parsed out of the topic name from the {status} field **]** */
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_012: [** The `requestId` parameter of the `response` event shall be parsed out of the topic name from the {request id} field **]** */
    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_013: [** The `body` parameter of the `response` event shall be the body of the received MQTT message **]**  */
    var response = {
      'status' : path[3],
      'requestId' : query.$rid,
      'body' : message
    };

    /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_004: [** If there is a listener for the `response` event, a `response` event shall be emitted for each response received. **]** */
    this.emit('response',response);
  }
};

MqttTwinReceiver.prototype._onPostMessage = function(topic, message) {
  if (topic.indexOf('$iothub/twin/PATCH/properties/desired/') === 0)
  {
    this.emit('post', message);
  }
};

MqttTwinReceiver.prototype._handleError = function(err) {
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_023: [** If the `error` event is subscribed to, an `error` event shall be emitted if any asynchronous subscribing operations fails. **]** */
  /* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_024: [** When the `error` event is emitted, the first parameter shall be an error object obtained via the MQTT `translateErrror` module. **]** */
  this.emit('error', translateError(err));
};


util.inherits(MqttTwinReceiver, EventEmitter);

module.exports = MqttTwinReceiver;


/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_020: [** If there is a listener for the post event, a post event shal be emitteded for each post message received **]** */
/* Codes_SRS_NODE_DEVICE_MQTT_TWIN_RECEIVER_18_022: [** When a post event it emitted, the parameter shall be the body of the message **]** */



