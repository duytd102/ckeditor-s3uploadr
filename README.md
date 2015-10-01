# ckeditor-s3uploadr
CKEditor plugin extend image plugin to upload file to s3


# Configuration
```
   config.s3uploadrConfig = {
        s3: {
            properties: {
                acl: 'public-read'
            },
            request: {
                accessKey: 'XXXXXXXXXXXXXXXXXXX',
                endpoint: 'https://yourbucket.s3.amazonaws.com', // bucket + region
                path: 'subfolder' // path in bucket to upload file
            },
            signature: {
                endpoint: 'http://localhost:8080/context/s3/validate' // server endpoint to generate signature
            }
        },
        validation: {
            acceptExtensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'],
            sizeLimit: 1024*1024
        }
    };
```
