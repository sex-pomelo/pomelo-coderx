
const MSG_FLAG_BYTES = 1;
const MSG_ROUTE_CODE_BYTES = 2;
const MSG_ROUTE_LEN_BYTES = 1;

const MSG_ROUTE_CODE_MAX = 0xffff;
const MSG_COMPRESS_GZIP_ENCODE_MASK = 1 << 4;



class Message {
  static TYPE_REQUEST = 0;
  static TYPE_NOTIFY = 1;
  static TYPE_RESPONSE = 2;
  static TYPE_PUSH = 3;

  /**
   * Message protocol encode.
   *
   * @param  {Number} id            message id
   * @param  {Number} type          message type
   * @param  {Number} compressRoute whether compress route
   * @param  {Number|String} route  route code or route string
   * @param  {Buffer} msg           message body bytes
   * @return {Buffer}               encode result
   */
  static encode (id, type, compressRoute, route, msg, compressGzip){
    // caculate message max length
    let idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0;
    let msgLen = MSG_FLAG_BYTES + idBytes;

    if(msgHasRoute(type)) {
      if(compressRoute) {
        if(typeof route !== 'number'){
          throw new Error('error flag for number route!');
        }
        msgLen += MSG_ROUTE_CODE_BYTES;
      } else {
        msgLen += MSG_ROUTE_LEN_BYTES;
        if(route) {
          if(route.length>255) {
            throw new Error('route maxlength is overflow');
          }
          msgLen += route.length;
        }
      }
    }

    if(msg) {
      msgLen += msg.length;
    }

    let buffer = Buffer.allocUnsafe(msgLen);
    let offset = 0;

    // add flag
    offset = encodeMsgFlag(type, compressRoute, buffer, offset, compressGzip);

    // add message id
    if(msgHasId(type)) {
      offset = encodeMsgId(id, buffer, offset);
    }

    // add route
    if(msgHasRoute(type)) {
      offset = encodeMsgRoute(compressRoute, route, buffer, offset);
    }

    // add body
    if(msg) {
      msg.copy( buffer, offset, 0, msg.length );
      offset = offset + msg.length;
    }

    return buffer;
  }

}


function msgHasId(type) {
  return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
};

function msgHasRoute(type) {
  return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY || type === Message.TYPE_PUSH;
};


function caculateMsgIdBytes(id) {
  let len = 0;
  do {
    len += 1;
    id >>= 7;
  } while(id > 0);
  return len;
};


function encodeMsgFlag(type, compressRoute, buffer, offset, compressGzip) {
  if(type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY &&
     type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) {
    throw new Error('unkonw message type: ' + type);
  }

  buffer[offset] = (type << 1) | (compressRoute ? 1 : 0);

  if(compressGzip) {
    buffer[offset] = buffer[offset] | MSG_COMPRESS_GZIP_ENCODE_MASK;
  }

  return offset + MSG_FLAG_BYTES;
};


function encodeMsgId(id, buffer, offset) {
  do{
    let tmp = id % 128;
    let next = Math.floor(id/128);

    if(next !== 0){
      tmp = tmp + 128;
    }
    buffer[offset++] = tmp;

    id = next;
  } while(id !== 0);

  return offset;
};

function encodeMsgRoute(compressRoute, route, buffer, offset) {
  if (compressRoute) {
    if(route > MSG_ROUTE_CODE_MAX){
      throw new Error('route number is overflow');
    }

    buffer[offset++] = (route >> 8) & 0xff;
    buffer[offset++] = route & 0xff;
  } else {
    if(route) {
      buffer[offset++] = route.length & 0xff;
      for( let i=0; i<route.length;i++ ){
        buffer[offset++] = route.charCodeAt(i);
      }
    } else {
      buffer[offset++] = 0;
    }
  }

  return offset;
};





module.exports = { encodeMsg: Message.encode };