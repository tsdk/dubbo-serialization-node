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

const {Writer, Reader} = require('protobufjs')
const ByteBuffer = require('byte');
const utils = require('../../utils');
const {PROTOBUF_JSON_SERIALIZATION_ID, PROTOBUF_SERIALIZATION_ID} = require('../const');

let encoder = Writer.create();
let decoder = null;

const input = {
  get bytes() {
    return ByteBuffer.wrap(decoder.buf);
  },
  skip(n) {
    decoder.skip(n);
  },
  readBool(options) {
    return this.readObject(options, 'BoolValue');
  },
  readByte(options) {
    const arr = decoder.bytes();
    return arr[arr.length - 1];
  },
  readShort(options) {
    const arr = decoder.bytes(), len = arr.length;
    return (arr[len - 2] << 8) | arr[len - 1];
  },
  readInt(options) {
    return this.readObject(options, 'Int32Value');
  },
  readLong(options) {
    return this.readObject(options, 'Int64Value');
  },
  readFloat(options) {
    return this.readObject(options, 'FloatValue');
  },
  readDouble(options) {
    return this.readObject(options, 'DoubleValue');
  },
  readBytes(options) {
    return this.readObject(options, 'BytesValue');
  },
  readUTF(options) {
    return this.readObject(options, 'StringValue');
  },
  readObject(options, type) {
    //todo
    const opts = options || {};
    if (opts.proto) {
      if (type) {
        const Msg = utils.findType(opts.proto, type);
        if (Msg) {
          const buf = decoder.bytes();
          const content = Buffer.concat([Buffer.from([buf.length]), buf]);
          let data;
          switch (type){
            case 'HashMap':
              data = Msg.decodeDelimited(content).toJSON().attachments;
              break;
            default:
              data = Msg.decodeDelimited(content).toJSON().value;
              break;
          }
          return data;
        }
      } else if (opts.channel) {
        //service reply buffer
        let appResponse = '';
        const data = opts.channel;
        const serviceId = data.req.requestProps.service || data.req.serverSignature;
        const methodInfo = utils.getMethodInfo(opts.proto, serviceId, data.req.methodName);
        if (methodInfo.responseType) {
          const responseType = methodInfo.resolvedResponseType;
          const buf = decoder.bytes();
          const content = Buffer.concat([Buffer.from([buf.length]), buf]);
          appResponse = responseType.decodeDelimited(content).toJSON();
        }
        return appResponse;
      }
    }
  },
};
const output = {
  bytes:null,
  get len() {
    return encoder.len;
  },
  get contentTypeId() {
    return PROTOBUF_JSON_SERIALIZATION_ID;
  },
  get() {
    return Buffer.concat([this.bytes.get(0, this.bytes._offset), encoder.finish()]);
  },
  writeBool(v, options) {
    return this.writeObject(v, null, 'BoolValue', options);
  },
  writeByte(v, options) {
    return this.writeObject(v, null, 'Int32Value', options);
  },
  writeShort(v, options) {
    return this.writeObject(v, null, 'Int32Value', options);
  },
  writeInt(v, options) {
    return this.writeObject(v, null, 'Int32Value', options);
  },
  writeLong(v, options) {
    return this.writeObject(v, null, 'Int64Value', options);
  },
  writeFloat(v, options) {
    return this.writeObject(v, null, 'FloatValue', options);
  },
  writeDouble(v, options) {
    return this.writeObject(v, null, 'DoubleValue', options);
  },
  writeBytes(v, options) {
    return this.writeObject(v, null, 'BytesValue', options);
  },
  writeUTF(v, options) {
    if (options.options) {
      return this.writeObject(v, null, 'StringValue', options);
    } else {
      return this.string(v);
    }
  },
  writeObject(v, classMap, type, options) {
    //todo classMap
    if (v && options.options){
      const opts = options.options;
      if (v['$class'] && v['$'] && opts.proto) {
        const Msg = utils.findType(opts.proto, v['$class']);
        if (Msg) {
          const bytes = Msg.create(v['$']).toJSON();
          const buf = Buffer.from(JSON.stringify(bytes) + "\n", 'utf8');
          encoder.bytes(buf);
        }

      } else if (type && opts.proto) {
        const Msg = utils.findType(opts.proto, type);
        if (Msg){
          let bytes;
          switch (type) {
            case 'HashMap':
              const attachments = {
                path: v.path || '',
                interface: v.path || '',
                group: v.group || '',
                version: v.version || '',
              };
              bytes = {attachments:attachments};
              break;
            case 'AnyVal':
            default:
              bytes = Msg.create({value:v}).toJSON().value;
              break;
          }
          const buf = Buffer.from(JSON.stringify(bytes) + "\n", 'utf8');
          encoder.bytes(buf);
        }

      }
    }
  },
};

exports.serialize = () => {
  encoder.reset();
  delete output.bytes;
  output.bytes = new ByteBuffer();
  return output;
};
exports.deserialize = buf => {
  decoder = Reader.create(buf);
  return input;
};
