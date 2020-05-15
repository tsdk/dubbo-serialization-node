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

const is = require('is-type-of');
const utility = require('utility');

const MAX_SAFE_INTEGER = utility.MAX_SAFE_INTEGER;

let id = 0;
exports.newId = () => {
  id = id < MAX_SAFE_INTEGER ? id + 1 : 0;
  return id;
};

exports.concatBuffer = (buf_1, buf_2) => {
  const len_1 = buf_1.length;
  const len_2 = buf_2.length;
  const buf = Buffer.alloc(len_1 + len_2);
  buf_1.copy(buf, 0, 0, len_1);
  buf_2.copy(buf, len_1, 0, len_2);
  return buf;
};

exports.handleLong = require('hessian.js/lib/utils').handleLong;

const primitiveMap = {
  void: 'V',
  boolean: 'Z',
  byte: 'B',
  char: 'C',
  double: 'D',
  float: 'F',
  int: 'I',
  long: 'J',
  short: 'S',
};
const isArray = c => c.startsWith('[');
const getComponentType = c => {
  if (isArray(c)) {
    return c.slice(1);
  }
  return c;
};
const getJavaClassDesc = val => {
  if (is.nullOrUndefined(val)) {
    return 'Ljava/lang/Object;';
  }
  const type = typeof val;
  switch (type) {
    case 'boolean':
      return primitiveMap.boolean;
    case 'string':
      return 'Ljava/lang/String;';
    case 'number':
      if (is.long(val)) {
        return primitiveMap.long;
      }
      if (is.int(val)) {
        return primitiveMap.int;
      }
      return primitiveMap.double;
    default:
      break;
  }
  if (is.date(val)) {
    return 'Ljava/util/Date;';
  }
  if (is.buffer(val)) {
    return `[${primitiveMap.byte}`;
  }
  if (is.array(val)) {
    return 'Ljava/util/ArrayList;';
  }
  if (is.error(val)) {
    return 'Ljava/lang/Exception;';
  }
  if (!utility.has(val, '$class')) {
    return 'Ljava/util/HashMap;';
  }
  let ret = '';
  let $class = val.$abstractClass || val.$class;
  while (isArray($class)) {
    ret += '[';
    $class = getComponentType($class);
  }
  if (primitiveMap[$class]) {
    ret += primitiveMap[$class];
  } else {
    ret += `L${$class.replace(/\./g, '/')};`;
  }
  return ret;
};

exports.getJavaArgsDesc = args => args.map(arg => getJavaClassDesc(arg)).join('');

exports.desc2classArray = desc => {
  if (!desc) {
    return [];
  }
  const arr = [];
  const len = desc.length;
  for (let i = 0; i < len; ++i) {
    let type = desc[i];
    let prefix = '';
    let javaType;
    if (type === '[') {
      prefix = '[';
      type = desc[++i];
    }
    switch (type) {
      case 'V':
        javaType = 'void';
        break;
      case 'Z':
        javaType = 'boolean';
        break;
      case 'B':
        javaType = 'byte';
        break;
      case 'C':
        javaType = 'char';
        break;
      case 'D':
        javaType = 'double';
        break;
      case 'F':
        javaType = 'float';
        break;
      case 'I':
        javaType = 'int';
        break;
      case 'J':
        javaType = 'long';
        break;
      case 'S':
        javaType = 'short';
        break;
      case 'L':
      {
        let clazz = '';
        while (i < len && desc[++i] !== ';') {
          clazz += desc[i];
        }
        javaType = clazz.replace(/\//g, '.');
        break;
      }
      default:
        throw new Error(`[double-remoting] unknown class type => ${type}`);
    }
    arr.push(`${prefix}${javaType}`);
  }
  return arr;
};

const typeMap = new Map();
const findType = (root, path) => {
  let target = typeMap.get(path);
  if (target) return target;
  target = root.lookup(path);
  if (target)
    typeMap.set(path, target);
  else 
    throw new Error(`no such Type '${path}' in proto file`);
  return target;
}
exports.findType = findType;

const serviceMap = new Map();
const findService = (root, path) => {
  let target = serviceMap.get(path);
  if (target) return target;
  target = root.lookup(path);
  if (target)
    serviceMap.set(path, target);
  else 
    throw new Error(`no such Service '${path}' in proto file`);
  return target;
}
exports.findService = findService;

exports.crc32 = buf => {
  const r = crc.crc32(buf);
  // crc32 返回的是一个 unsigned int32，需要转换成 int32
  return (r % TWO_PWR_32_DBL) | 0;
};
/* eslint-enable no-bitwise */

const methodMap = new Map();
exports.getMethodInfo = (proto, serviceId, methodName) => {
  const serviceName = serviceId.split(':')[0];
  const key = serviceId + '#' + methodName;
  let method = methodMap.get(key);
  if (!method) {
    const service = findService(proto, serviceName);
    method = service.get(methodName) || service.get(methodName.charAt(0).toUpperCase() + methodName.slice(1));
    if (!method) {
      throw new Error(`no such Method '${methodName}' in Service '${serviceId}'`);
    }
    method = method.resolve();
    methodMap.set(key, method);
  }
  return method;
};

const DEFAULT_CLASSNAME = {
  boolean: 'boolean',
  int: 'int',
  long: 'long',
  double: 'double',
  date: 'java.util.Date',
  string: 'java.lang.String',
  byteArray: '[B',
  list: 'java.util.ArrayList',
  map: 'java.util.HashMap',
  exception: 'java.lang.RuntimeException',
  null: 'null',
};

const arrayTypeMap = {
  short: 'S',
  int: 'I',
  boolean: 'Z',
  double: 'D',
  long: 'J',
  float: 'F',
  byte: 'B',
  string: 'Ljava.lang.String;',
  object: 'Ljava.lang.Object;',
};

/*
 * auto detect a val to a java type
 * if val.$class was set, return val.$class
 * @param {Object} val
 * @return {String}
 */
exports.getJavaClassname = val => {
  if (is.nullOrUndefined(val) || is.NaN(val)) {
    return DEFAULT_CLASSNAME.null;
  }

  if (val.$class) {
    const type = has(val, '$abstractClass') ? val.$abstractClass : val.$class;

    // 数组
    if (val.isArray) {
      const arrayDepth = val.arrayDepth || 1;
      let prefix = '';
      for (let i = 0; i < arrayDepth; i++) {
        prefix += '[';
      }
      return prefix + (arrayTypeMap[type] || ('L' + type + ';'));
    }
    if (type.startsWith('[')) {
      const len = type.length;
      let i = 0;
      for (; i < len; i++) {
        if (type[i] !== '[') break;
      }
      const prefix = type.slice(0, i);
      const itemType = type.slice(i);
      return prefix + (arrayTypeMap[itemType] || ('L' + itemType + ';'));
    }
    return type;
  }

  const type = typeof val;
  switch (type) {
    case 'boolean':
      return DEFAULT_CLASSNAME.boolean;
    case 'string':
      return DEFAULT_CLASSNAME.string;
    case 'number':
      if (is.long(val)) {
        return DEFAULT_CLASSNAME.long;
      }
      if (is.int(val)) {
        return DEFAULT_CLASSNAME.int;
      }
      return DEFAULT_CLASSNAME.double;
    default:
      break;
  }

  if (is.date(val)) {
    return DEFAULT_CLASSNAME.date;
  }
  if (is.buffer(val)) {
    return DEFAULT_CLASSNAME.byteArray;
  }
  if (is.array(val)) {
    return DEFAULT_CLASSNAME.list;
  }
  if (is.error(val)) {
    return DEFAULT_CLASSNAME.exception;
  }

  return DEFAULT_CLASSNAME.map;
};

exports.writeMethodArgs = (args, encoder) => {
  for (let i = 0; i < args.length; i++) {
    // support {$class: 'java.lang.String', $: null}
    let arg = args[i];
    if (arg && arg.$class && is.nullOrUndefined(arg.$)) {
      arg = null;
    }
    encoder.write(arg);
  }
};

function flatCopyTo(prefix, sourceMap, distMap) {
  for (const k in sourceMap) {
    const key = prefix + k;
    const val = sourceMap[k];
    if (typeof val === 'string') {
      distMap[key] = val;
    } else if (typeof val === 'number') {
      distMap[key] = val.toString();
    } else if (typeof val === 'object') {
      flatCopyTo(key + '.', val, distMap);
    }
  }
}
exports.flatCopyTo = flatCopyTo;

function treeCopyTo(prefix, sourceMap, distMap, remove) {
  const len = prefix.length;
  for (const key in sourceMap) {
    if (key.startsWith(prefix)) {
      distMap[key.slice(len)] = sourceMap[key];
      if (remove) {
        delete sourceMap[key];
      }
    }
  }
}
exports.treeCopyTo = treeCopyTo;
