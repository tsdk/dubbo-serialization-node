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

let encoder = ByteBuffer.allocate();
let decoder = null;

const input = {
  get bytes() {
    return decoder;
  },
  skip(n) {
    decoder.skip(n);
  },
  readBool(options) {
    return this.readObject(options, 'BoolValue');
  },
  readByte(options) {
    return decoder.read(1);
  },
  readShort(options) {
    return decoder.read(2);
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
  readLine() {
    const pos = decoder.position();
    const idx = decoder._bytes.indexOf(0x0a, pos);
    const ret = decoder.read(idx - pos + 1);
    return ret.toString();
  },
  readObject(options, type) {
    //todo
    const opts = options || {};
    if (opts.proto) {
      if (type) {
        let buf = this.readLine();
        const json = JSON.parse(buf);
        let data;
        switch (type){
          case 'HashMap':
            data = json.attachments;
            break;
          default:
            data = json;
            break;
        }
        return data;
      } else if (opts.channel) {
        //service reply buffer
        let buf = this.readLine();
        const json = JSON.parse(buf);
        return json;
      }
    }
  },
};
const output = {
  bytes:null,
  get len() {
    const pos = encoder.position();
    return pos;
  },
  get contentTypeId() {
    return PROTOBUF_JSON_SERIALIZATION_ID;
  },
  get() {
    const data = encoder._bytes.slice(0, encoder._offset);
    return data;
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
    if (options && options.options) {
      return this.writeObject(v, null, 'StringValue', options);
    } else {
      return encoder.putRawString(v);
    }
  },
  writeObject(v, classMap, type, options) {
    //todo classMap
    if (v && options.options){
      const opts = options.options;
      if (v['$class'] && v['$'] && opts.proto) {
        const buf = JSON.stringify(v['$']) + "\n";
        encoder.putRawString(buf);

      } else if (type && opts.proto) {
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
            bytes = v;
            break;
        }
        const buf = JSON.stringify(bytes) + "\n";
        encoder.putRawString(buf);

      }
    }
  },
};

exports.serialize = () => {
  encoder.reset();
  output.bytes = encoder;
  return output;
};
exports.deserialize = buf => {
  if (decoder) decoder.clear();
  decoder = ByteBuffer.wrap(buf);
  return input;
};
