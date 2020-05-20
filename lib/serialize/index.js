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

const {HESSIAN2_SERIALIZATION_ID, PROTOBUF_JSON_SERIALIZATION_ID, PROTOBUF_SERIALIZATION_ID, PROTOSTUFF_SERIALIZATION_ID} = require('./const');

const idToSerializations = {
  [HESSIAN2_SERIALIZATION_ID]: require('./hessian'),
  //[PROTOSTUFF_SERIALIZATION_ID]: require('./protostuff'), //todo not support
  [PROTOBUF_JSON_SERIALIZATION_ID]: require('./protobuf-json'),
  [PROTOBUF_SERIALIZATION_ID]: require('./protobuf')
};
const nameToSerializations = {
  "hessian2": require('./hessian'),
  //"protostuff": require('./protostuff'),
  "protobuf-json": require('./protobuf-json'),
  "protobuf": require('./protobuf')
};

exports.getSerializationById = id => {
  return idToSerializations[id];
};

exports.getSerializationByName = name => {
  return nameToSerializations[name];
};

exports.getSerializationNameById = id => {
  switch (parseInt(id, 10)) {
    case PROTOSTUFF_SERIALIZATION_ID:
      return 'protostuff';
    case PROTOBUF_JSON_SERIALIZATION_ID:
      return 'protobuf-json';
    case PROTOBUF_SERIALIZATION_ID:
      return 'protobuf';
    default:
      return 'hessian2';
  }
};
