/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Long = require('long');
const is = require('is-type-of');
const utils = require('../utils');
const Constants = require('../const');
const Invocation = require('./invocation');
const getSerializationById = require('../serialize').getSerializationById;
const getSerializationByName = require('../serialize').getSerializationByName;

const DUBBO_VERSION = '2.5.3';
const HEADER_LENGTH = 16;
const MAGIC_HIGH = 0xda;
const MAGIC_LOW = 0xbb;
const FLAG_EVENT = 0x20;
const FLAG_TWOWAY = 0x40;
const FLAG_REQUEST = 0x80;
const HEARTBEAT_EVENT = null;
const SERIALIZATION_MASK = 0x1f;

class Request {
  constructor(id) {
    this.id = id != null ? id : utils.newId();
    this.version = '2.0.0';
    this.isTwoWay = true;
    this.isEvent = false;
    this.isBroken = false;
    this.data = null;
  }

  get isResponse() {
    return false;
  }

  get event() {
    return this.isEvent ? this.data : null;
  }

  set event(val) {
    this.isEvent = true;
    this.data = val;
  }

  get isHeartbeat() {
    return this.isEvent && this.event === HEARTBEAT_EVENT;
  }

  encode(options = {}) {
    let { codecType, classMap } = options;
    const output = getSerializationByName(codecType || Constants.DEFAULT_REMOTING_SERIALIZATION).serialize();
    const bytes = output.bytes;

    bytes.put(MAGIC_HIGH);
    bytes.put(MAGIC_LOW);
    let flag = FLAG_REQUEST | output.contentTypeId;
    if (this.isTwoWay) {
      flag |= FLAG_TWOWAY;
    }
    if (this.isEvent) {
      flag |= FLAG_EVENT;
    }
    bytes.put(flag);
    bytes.put(0);
    bytes.putLong(this.id);
    bytes.skip(4);

    // data 如果是 invocation 需要特殊处理下，其余的当 hashmap 处理
    if (this.data instanceof Invocation) {
      const inv = this.data;
      output.writeUTF(inv.attachments[Constants.DUBBO_VERSION_KEY] || DUBBO_VERSION, options);
      output.writeUTF(inv.attachments[Constants.PATH_KEY], options);
      output.writeUTF(inv.attachments[Constants.VERSION_KEY] || '0.0.0', options);

      output.writeUTF(inv.methodName, options);
      const desc = utils.getJavaArgsDesc(inv.args);
      output.writeUTF(desc, options);
      const types = utils.desc2classArray(desc);

      for (let i=0; i < types.length; i++) {
        output.writeObject(inv.args[i], classMap, types[i], options);
      }
      output.writeObject(inv.attachments, classMap, 'HashMap', options);
    } else {
      if (this.isEvent) {
        output.writeUTF('H', options);
      } else {
        output.writeObject(this.data, classMap, 'AnyVal', options);
      }
    }

    let bodyLen = 0;
    if (codecType != Constants.DEFAULT_REMOTING_SERIALIZATION) {
      bodyLen = output.len;
    } else {
      bodyLen = bytes.position() - HEADER_LENGTH;
    }
    bytes._bytes.writeInt32BE(bodyLen, 12);
    const buf = output.get();
    return buf;
  }

  static decode(buf, options = {}) {
    const packetId = utils.handleLong(new Long(
      buf.readInt32BE(8), // low, high
      buf.readInt32BE(4)
    ));

    const flag = buf[2];
    const sType = flag & SERIALIZATION_MASK;
    const input = getSerializationById(sType).deserialize(buf);
    if (sType == 21) options.codecType = 'protobuf';
    // skip header
    input.skip(16);

    let packetType = 'request';
    let data;
    if ((flag & FLAG_EVENT) !== 0) {
      packetType = 'heartbeat';
      data = input.readObject(options);
    } else {
      const field = input.readObject(options, 'AnyVal');
      if (is.string(field)) {
        const attachments = {
          [Constants.DUBBO_VERSION_KEY]: field,
          [Constants.PATH_KEY]: input.readUTF(options),
        };
        const version = input.readUTF(options);
        const methodName = input.readUTF(options);
        const desc = input.readUTF(options);
        const methodArgSigs = utils.desc2classArray(desc);
        const argLen = methodArgSigs.length;
        const args = [];

        for (let i = 0; i < argLen; ++i) {
          args.push(input.readObject(options, methodArgSigs[i]));
        }
        Object.assign(attachments, input.readObject(options, 'HashMap'));

        const serverSignature = version ? attachments.path + ':' + version : attachments.path;
        data = {
          methodName,
          serverSignature,
          args,
          methodArgSigs,
          requestProps: attachments,
        };
      } else {
        data = field;
      }
    }

    return {
      packetId,
      packetType,
      data,
      options: {
        protocolType: 'dubbo',
        codecType: options.codecType || 'hessian2',
        classMap: options.classMap,
      },
      meta: null,
    };
  }
}

module.exports = Request;
