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

const { Writer, Reader, Root } = require('protobufjs');
const ByteBuffer = require('byte');
const utils = require('../../utils');
const {
  PROTOBUF_JSON_SERIALIZATION_ID,
  PROTOBUF_SERIALIZATION_ID,
} = require('../const');

let encoder = Writer.create();
let decoder = null;
const mapType = {
  'java.lang.String': 'StringValue',
  'java.util.HashMap': 'HashMap',
  'java.util.ArrayList': 'ArrayValue',
  'java.lang.Exception': 'AnyVal',
  boolean: 'BoolValue',
  int: 'Int32Value',
  long: 'Int64Value',
  double: 'DoubleValue',
};
const conversionOptions = {
  enums: String, // enums as string names
  longs: String, // longs as strings (requires long.js)
  bytes: String, // bytes as base64 encoded strings
  defaults: true, // includes default values
  arrays: true, // populates empty arrays (repeated fields) even if defaults=false
  objects: true, // populates empty objects (map fields) even if defaults=false
  oneofs: true, // includes virtual oneof fields set to the present field's name
};

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
    const arr = decoder.bytes(),
      len = arr.length;
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
        type = mapType[type] || type;
        const Msg = utils.findType(opts.proto, type);
        if (Msg) {
          const buf = decoder.bytes();
          let data = '';
          try {
            data = Msg.toObject(Msg.decode(buf), conversionOptions);
            if (opts.proto[type]) data = data.value;
          } catch (e) {
            const content = Buffer.concat([
              Buffer.from(utils.int2hex(buf.length), 'hex'),
              buf,
            ]);
            data = Msg.toObject(
              Msg.decodeDelimited(content),
              conversionOptions
            );
            if (opts.proto[type]) data = data.value;
          }
          if (data instanceof Map)
            return [...data.entries()].reduce(
              (obj, [k, value]) => ((obj[k] = value), obj),
              {}
            );
          return data;
        }
      } else if (opts.channel) {
        //service reply buffer
        let appResponse = '';
        const data = opts.channel;
        const serviceId =
          data.req.requestProps.service || data.req.serverSignature;
        const methodInfo = utils.getMethodInfo(
          opts.proto,
          serviceId,
          data.req.methodName
        );
        if (methodInfo.responseType) {
          const responseType = methodInfo.resolvedResponseType;
          const buf = decoder.bytes();
          try {
            appResponse = responseType.toObject(
              responseType.decode(buf),
              conversionOptions
            );
          } catch (e) {
            const content = Buffer.concat([
              Buffer.from(utils.int2hex(buf.length), 'hex'),
              buf,
            ]);
            appResponse = responseType.toObject(
              responseType.decodeDelimited(content),
              conversionOptions
            );
          }
        }
        return appResponse;
      }
    }
  },
};
const output = {
  bytes: null,
  get len() {
    return encoder.len;
  },
  get contentTypeId() {
    return PROTOBUF_SERIALIZATION_ID;
  },
  get() {
    let ret;
    if (this.bytes._offset > 16) {
      //heartbeat
      ret = Buffer.concat([this.bytes.get(0, this.bytes._offset)]);
    } else {
      const len = encoder.len;
      const end = encoder.finish().slice(0, len);
      ret = Buffer.concat([this.bytes.get(0, this.bytes._offset), end]);
    }
    return ret;
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
      const json = {
        nested: {
          StringValue: {
            fields: {
              value: {
                type: 'string',
                id: 1,
              },
            },
          },
        },
      };
      const Msg = Root.fromJSON(json).lookup('StringValue');
      const bytes = Msg.encodeDelimited(Msg.create({ value: v })).finish();
      encoder.len += 4;
      return this.bytes.put(bytes);
    }
  },
  writeObject(v, classMap, type, options) {
    //todo classMap
    if (options.options) {
      const opts = options.options;
      if (v && v['$class'] && v['$'] && opts.proto) {
        v['$class'] = mapType[v['$class']] || v['$class'];
        const Msg = utils.findType(opts.proto, v['$class']);
        if (Msg) {
          if (v['$'] instanceof Error) v['$'] = v['$'].message;
          const bytes = Msg.encode(Msg.create(v['$'])).finish();
          encoder.bytes(bytes);
        }
      } else if (type && opts.proto) {
        type = mapType[type] || type;
        const Msg = utils.findType(opts.proto, type);
        if (Msg) {
          let bytes;
          switch (type) {
            case 'HashMap':
              const arr = Object.entries(v);
              let attachments = {};
              for (let [key, val] of arr) {
                const type = typeof val;
                if (type == 'string' || type == 'number') {
                  attachments[key] = val.toString();
                }
              }
              bytes = Msg.encode(Msg.create({ value: attachments })).finish();
              break;
            case 'AnyVal':
            default:
              if (v.constructor && v.constructor.encode)
                bytes = v.constructor.encode(v).finish();
              else bytes = Msg.encode(Msg.create({ value: v })).finish();
              break;
          }
          encoder.bytes(bytes);
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
