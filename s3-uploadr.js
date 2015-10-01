(function() {
    var AWS_PARAM_PREFIX = "x-amz-meta-",
        SESSION_TOKEN_PARAM_NAME = "x-amz-security-token",
        REDUCED_REDUNDANCY_PARAM_NAME = "x-amz-storage-class",
        REDUCED_REDUNDANCY_PARAM_VALUE = "REDUCED_REDUNDANCY",
        SERVER_SIDE_ENCRYPTION_PARAM_NAME = "x-amz-server-side-encryption",
        SERVER_SIDE_ENCRYPTION_PARAM_VALUE = "AES256";

    var PLUGIN_NAME = 'image',
        INFO_TAB_ID = 'info',
        DEFAULT_UPLOAD_TAB_ID = 'Upload',
        ADVANCED_TAB_ID = 'advanced',
        UPLOAD_ID = 'uploadTab',
        TXT_IMAGE_URL = 'txtUrl',
        BT_UPLOAD_FILE = 'btUploadFile',
        BT_UPLOAD_BUTTON = 'btUploadButton',
        LB_UPLOAD_ERROR = 'lbUploadError';

    var numbering = function(id) {
            return CKEDITOR.tools.getNextId() + '_' + id;
        },
        btnLockSizesId = numbering('btnLockSizes');

    var qq = {},
        s3 = {};

    CKEDITOR.on('dialogDefinition', function(ev) {
        var dialogName = ev.data.name;
        var dialogDefinition = ev.data.definition;
        var CONFIG = ev.editor.config.s3uploadrConfig;

        if (dialogName !== PLUGIN_NAME) {
            return;
        }

        dialogDefinition.removeContents(DEFAULT_UPLOAD_TAB_ID);

        dialogDefinition.addContents({
            id: UPLOAD_ID,
            label: 'Upload',
            elements: [{
                id: BT_UPLOAD_FILE,
                type: 'file',
                label: 'Select an image to upload',
                onChange: function() {
                    var uploadButton = this.getDialog().getContentElement(UPLOAD_ID, BT_UPLOAD_BUTTON);
                    if (this.getInputElement().$.files.length > 0) {
                        uploadButton.enableControl();
                    } else {
                        uploadButton.disableControl();
                    }
                    this.getDialog().getContentElement(UPLOAD_ID, LB_UPLOAD_ERROR).updateMessage('');
                },
                clear: function() {
                    this.getInputElement().setValue('');
                }

            }, {
                id: BT_UPLOAD_BUTTON,
                type: 'button',
                label: 'Send it to the Server',
                onClick: function(ev) {
                    var thisButton = this,
                        uploadFile = thisButton.getDialog().getContentElement(UPLOAD_ID, BT_UPLOAD_FILE),
                        lbErr = thisButton.getDialog().getContentElement(UPLOAD_ID, LB_UPLOAD_ERROR),
                        fileList = uploadFile.getInputElement().$.files,
                        file = fileList[0];

                    CONFIG.validation.acceptExtensions = CONFIG.validation.acceptExtensions == null ? [] : CONFIG.validation.acceptExtensions;
                    CONFIG.validation.acceptExtensions = qq.isArray(CONFIG.validation.acceptExtensions) ? CONFIG.validation.acceptExtensions : [CONFIG.validation.acceptExtensions];

                    if (thisButton.enabled) {

                        if (fileList.length === 0) {
                            lbErr.updateMessage('No image file to upload');
                            return;
                        }

                        if (file.size > CONFIG.validation.sizeLimit) {
                            lbErr.updateMessage('File size limit: ' + qq.formatBytes(CONFIG.validation.sizeLimit));
                            return;
                        }

                        if (!qq.inList(CONFIG.validation.acceptExtensions, qq.getExtension(file.name))) {
                            lbErr.updateMessage('Only accept extensions: ' + qq.arrayToString(CONFIG.validation.acceptExtensions));
                            return;
                        }

                        thisButton.disableControl();

                        s3.uploadS3(CONFIG, file).then(function(s3Url) {
                            thisButton.getDialog().getContentElement(INFO_TAB_ID, TXT_IMAGE_URL).setValue(s3Url);
                            thisButton.getDialog().selectPage(INFO_TAB_ID);

                        }, function(err) {
                            lbErr.updateMessage('Failed to upload');

                        }).always(function() {
                            uploadFile.clear();
                            thisButton.enableControl();
                        });
                    }
                },
                onShow: function() {
                    this.disableControl();
                },
                enableControl: function() {
                    this.enabled = true;
                    var ele = this.getElement();
                    ele.removeStyle('cursor');
                    ele.removeStyle('border-color');
                    ele.removeStyle('opacity');
                    ele.removeStyle('background-color');
                    var children = ele.getChildren();
                    for (var i = 0; i < children.count(); i++) {
                        var child = children.getItem(i);
                        child.removeStyle('cursor');
                    }
                },
                disableControl: function() {
                    this.enabled = false;
                    var ele = this.getElement();
                    ele.setStyles({
                        'cursor': 'default',
                        'border-color': '#ddd',
                        'opacity': 0.7,
                        'background-color': '#f4f4f4'
                    });
                    var children = ele.getChildren();
                    for (var i = 0; i < children.count(); i++) {
                        var child = children.getItem(i);
                        child.setStyle('cursor', 'default');
                    }
                }
            }, {
                id: LB_UPLOAD_ERROR,
                type: 'html',
                html: '',
                hidden: false,
                style: 'color:red',

                onShow: function() {
                    this.getElement().setHtml('');
                },

                updateMessage: function(msg) {
                    if (msg == null || CKEDITOR.tools.trim(msg).length === 0) {
                        this.getElement().hide();
                    } else {
                        this.getElement().show();
                    }
                    this.getElement().setHtml(msg);
                }
            }]
        }, ADVANCED_TAB_ID);
    });



    s3.uploadS3 = function(CONFIG, file, key) {
        key = CONFIG.s3.request.path + '/' + qq.uuid() + '.' + qq.getExtension(file.name);
        return s3.getSignature({
            type: file.type,
            objectProperties: {
                acl: CONFIG.s3.properties.acl,
                key: key
            },
            request: {
                endpoint: CONFIG.s3.request.endpoint,
                accessKey: CONFIG.s3.request.accessKey
            },
            signature: {
                endpoint: CONFIG.s3.signature.endpoint
            }
        }).then(function(data) {
            return qq.ajax(CONFIG.s3.request.endpoint, qq.obj2FormData({
                key: key,
                acl: CONFIG.s3.properties.acl,
                "Content-Type": file.type,
                "AWSAccessKeyId": CONFIG.s3.request.accessKey,
                "Policy": data.policy,
                "Signature": data.signature,
                "file": file
            })).then(function(res) {
                return CONFIG.s3.request.endpoint + '/' + key;
            });
        });
    };

    s3.getSignature = function(spec) {
        return qq.ajax(spec.signature.endpoint, JSON.stringify(s3.getPolicy({
            key: spec.objectProperties.key,
            acl: spec.objectProperties.acl,
            endpoint: spec.request.endpoint,
            accessKey: spec.request.accessKey,
            type: spec.type,
            expectedStatus: spec.expectedStatus,
            sessionToken: spec.sessionToken,
            params: spec.params,
            minFileSize: spec.minFileSize,
            maxFileSize: spec.maxFileSize,
            reducedRedundancy: spec.reducedRedundancy
        }))).then(function(res) {
            return JSON.parse(res);
        });
    }

    s3.getPolicy = function(spec) {
        var policy = {},
            conditions = [],
            bucket = s3.getBucket(spec.endpoint),
            key = spec.key,
            acl = spec.acl,
            type = spec.type,
            expirationDate = new Date(),
            expectedStatus = spec.expectedStatus,
            sessionToken = spec.sessionToken,
            params = spec.params,
            minFileSize = spec.minFileSize,
            maxFileSize = spec.maxFileSize,
            reducedRedundancy = spec.reducedRedundancy,
            serverSideEncryption = spec.serverSideEncryption,
            successRedirectUrl = spec.successRedirectUrl;

        policy.expiration = s3.getPolicyExpirationDate(expirationDate);

        conditions.push({
            acl: acl
        });
        conditions.push({
            bucket: bucket
        });

        if (type) {
            conditions.push({
                "Content-Type": type
            });
        }

        if (expectedStatus) {
            conditions.push({
                success_action_status: expectedStatus.toString()
            });
        }

        if (successRedirectUrl) {
            conditions.push({
                success_action_redirect: successRedirectUrl
            });
        }

        if (reducedRedundancy) {
            conditions.push({});
            conditions[conditions.length - 1][REDUCED_REDUNDANCY_PARAM_NAME] = REDUCED_REDUNDANCY_PARAM_VALUE;
        }

        if (sessionToken) {
            conditions.push({});
            conditions[conditions.length - 1][SESSION_TOKEN_PARAM_NAME] = sessionToken;
        }

        if (serverSideEncryption) {
            conditions.push({});
            conditions[conditions.length - 1][SERVER_SIDE_ENCRYPTION_PARAM_NAME] = SERVER_SIDE_ENCRYPTION_PARAM_VALUE;
        }

        conditions.push({
            key: key
        });

        // user metadata
        qq.each(params, function(name, val) {
            var awsParamName = AWS_PARAM_PREFIX + name,
                param = {};

            param[awsParamName] = encodeURIComponent(val);
            conditions.push(param);
        });

        policy.conditions = conditions;

        s3.enforceSizeLimits(policy, minFileSize, maxFileSize);

        return policy;
    }

    s3.getPolicyExpirationDate = function(date) {
        date.setMinutes(date.getMinutes() + 5);

        if (Date.prototype.toISOString) {
            return date.toISOString();
        } else {
            var pad = function(number) {
                var r = String(number);
                if (r.length === 1) {
                    r = "0" + r;
                }
                return r;
            };

            return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate()) + "T" + pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) + "." + String((date.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5) + "Z";
        }
    }

    /**
     * This allows for the region to be specified in the bucket's endpoint URL, or not.
     *
     * Examples of some valid endpoints are:
     *     http://foo.s3.amazonaws.com
     *     https://foo.s3.amazonaws.com
     *     http://foo.s3-ap-northeast-1.amazonaws.com
     *     foo.s3.amazonaws.com
     *     http://foo.bar.com
     *     http://s3.amazonaws.com/foo.bar.com
     * ...etc
     *
     * @param endpoint The bucket's URL.
     * @returns {String || undefined} The bucket name, or undefined if the URL cannot be parsed.
     */
    s3.getBucket = function(endpoint) {
        var patterns = [
            //bucket in domain
            /^(?:https?:\/\/)?([a-z0-9.\-_]+)\.s3(?:-[a-z0-9\-]+)?\.amazonaws\.com/i,
            //bucket in path
            /^(?:https?:\/\/)?s3(?:-[a-z0-9\-]+)?\.amazonaws\.com\/([a-z0-9.\-_]+)/i,
            //custom domain
            /^(?:https?:\/\/)?([a-z0-9.\-_]+)/i
        ];
        var bucket;

        qq.each(patterns, function(idx, pattern) {
            var match = pattern.exec(endpoint);

            if (match) {
                bucket = match[1];
                return false;
            }
        });

        return bucket;
    }

    s3.enforceSizeLimits = function(policy, minSize, maxSize) {
        var adjustedMinSize = minSize < 0 ? 0 : minSize,
            // Adjust a maxSize of 0 to the largest possible integer, since we must specify a high and a low in the request
            adjustedMaxSize = maxSize <= 0 ? 9007199254740992 : maxSize;

        if (minSize > 0 || maxSize > 0) {
            policy.conditions.push(["content-length-range", adjustedMinSize.toString(), adjustedMaxSize.toString()]);
        }
    }

    qq.obj2FormData = function(obj, formData, arrayKeyName) {
        if (!formData) {
            formData = new FormData();
        }

        qq.each(obj, function(key, val) {
            key = arrayKeyName ? arrayKeyName + "[" + key + "]" : key;

            if (qq.isObject(val)) {
                qq.obj2FormData(val, formData, key);
            } else if (qq.isFunction(val)) {
                formData.append(key, val());
            } else {
                formData.append(key, val);
            }
        });

        return formData;
    }

    qq.ajax = function(url, data, o) {
        var xhr = new XMLHttpRequest();
        var defer = $.Deferred();
        o = o || {};
        var method = o.method ? o.method.toUpperCase() : 'POST';
        if (o.headers) {
            for (var k in o.headers) {
                if (o.headers.hasOwnProperty(k)) {
                    xhr.setRequestHeader(k, o.headers[k]);
                }
            }
        }
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (isSuccessfulResponse(method, xhr.status)) {
                    defer.resolve(xhr.responseText);
                } else {
                    defer.reject(xhr.responseText);
                }
            }
        };
        if (o.progress) {
            xhr.upload.addEventListener("progress", o.progress, false);
        }
        xhr.open(method, url, true);
        xhr.send(data);
        return defer;

        function isSuccessfulResponse(method, status) {
            var successfulResponseCodes = {
                "DELETE": [200, 202, 204],
                "POST": [200, 204],
                "GET": [200]
            };
            return successfulResponseCodes[method].indexOf(status) !== -1;
        }
    };

    qq.each = function(iterableItem, callback) {
        var keyOrIndex, retVal;

        if (iterableItem) {
            // Iterate through [`Storage`](http://www.w3.org/TR/webstorage/#the-storage-interface) items
            if (window.Storage && iterableItem.constructor === window.Storage) {
                for (keyOrIndex = 0; keyOrIndex < iterableItem.length; keyOrIndex++) {
                    retVal = callback(iterableItem.key(keyOrIndex), iterableItem.getItem(iterableItem.key(keyOrIndex)));
                    if (retVal === false) {
                        break;
                    }
                }
            }

            // `DataTransferItemList` & `NodeList` objects are array-like and should be treated as arrays
            // when iterating over items inside the object.
            else if (qq.isArray(iterableItem) || qq.isItemList(iterableItem) || qq.isNodeList(iterableItem)) {
                for (keyOrIndex = 0; keyOrIndex < iterableItem.length; keyOrIndex++) {
                    retVal = callback(keyOrIndex, iterableItem[keyOrIndex]);
                    if (retVal === false) {
                        break;
                    }
                }
            } else if (qq.isString(iterableItem)) {
                for (keyOrIndex = 0; keyOrIndex < iterableItem.length; keyOrIndex++) {
                    retVal = callback(keyOrIndex, iterableItem.charAt(keyOrIndex));
                    if (retVal === false) {
                        break;
                    }
                }
            } else {
                for (keyOrIndex in iterableItem) {
                    if (Object.prototype.hasOwnProperty.call(iterableItem, keyOrIndex)) {
                        retVal = callback(keyOrIndex, iterableItem[keyOrIndex]);
                        if (retVal === false) {
                            break;
                        }
                    }
                }
            }
        }
    }

    qq.isObject = function(variable) {
        return variable && !variable.nodeType && Object.prototype.toString.call(variable) === "[object Object]";
    };

    qq.isFunction = function(variable) {
        return typeof(variable) === "function";
    };

    /**
     * Check the type of a value.  Is it an "array"?
     *
     * @param value value to test.
     * @returns true if the value is an array or associated with an `ArrayBuffer`
     */
    qq.isArray = function(value) {
        return Object.prototype.toString.call(value) === "[object Array]" ||
            (value && window.ArrayBuffer && value.buffer && value.buffer.constructor === ArrayBuffer);
    };

    // Looks for an object on a `DataTransfer` object that is associated with drop events when utilizing the Filesystem API.
    qq.isItemList = function(maybeItemList) {
        return Object.prototype.toString.call(maybeItemList) === "[object DataTransferItemList]";
    };

    // Looks for an object on a `NodeList` or an `HTMLCollection`|`HTMLFormElement`|`HTMLSelectElement`
    // object that is associated with collections of Nodes.
    qq.isNodeList = function(maybeNodeList) {
        return Object.prototype.toString.call(maybeNodeList) === "[object NodeList]" ||
            // If `HTMLCollection` is the actual type of the object, we must determine this
            // by checking for expected properties/methods on the object
            (maybeNodeList.item && maybeNodeList.namedItem);
    };

    qq.isString = function(maybeString) {
        return Object.prototype.toString.call(maybeString) === "[object String]";
    };

    qq.trimStr = function(string) {
        if (String.prototype.trim) {
            return string.trim();
        }
        return string.replace(/^\s+|\s+$/g, "");
    };

    /**
     * ['Get Extension'](http://stackoverflow.com/questions/190852/how-can-i-get-file-extensions-with-javascript)
     **/
    qq.getExtension = function(fileName) {
        return (/[.]/.exec(fileName)) ? /[^.]+$/.exec(fileName) : undefined;
    };

    qq.isImageFile = function(fileName) {
        var re = /(\.jpg|\.jpeg|\.bmp|\.gif|\.png)$/i;
        return re.exec(fileName);
    };

    qq.uuid = function() {
        return (S4() + S4() + S4() + "4" + S4().substr(0, 3) + S4() + S4() + S4() + S4()).toLowerCase();

        function S4() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }
    };

    qq.inList = function(list, value) {
        for (var i = 0, len = list.length; i < len; i++) {
            if (list[i] === value) {
                return true;
            }
        }
        return false;
    };

    qq.formatBytes = function(bytes, decimals) {
        if (bytes == 0) return '0 Byte';
        var k = 1000;
        var dm = decimals + 1 || 3;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toPrecision(dm) + ' ' + sizes[i];

    };

    qq.arrayToString = function(arr) {
        var rs = '';
        qq.each(arr, function(index, item) {
            rs += (rs.length > 0 ? ', ' : '') + item;
        });
        return rs;
    };
})();
