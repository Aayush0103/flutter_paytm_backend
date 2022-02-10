var express = require('express');
var port = process.env.PORT || 3000;
var app = express();

const https = require('https');

const checksum_lib = require('./checksum');


app.use(express.json()); 
app.use(express.urlencoded());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.get('/', function(req, res) {
    console.log(req);
    res.send(JSON.stringify({ Hello: 'World' }));
});
app.post('/generateTxnToken', function(request, res) {
    console.log(request.body);

    var paytmParams = {};

    var MID = request.body.mid;
    var orderId = request.body.orderId;

    var amount = parseFloat(String(request.body.amount));
    var custId = request.body.custId;
    var key_secret = request.body.key_secret;
    var callbackUrl = request.body.callbackUrl;
    var mode = request.body.mode;
    var website = request.body.website;
    var testing = String(request.body.testing);
    console.log(callbackUrl);
    console.log(mode);


    paytmParams.body = {

        /* for custom checkout value is 'Payment' and for intelligent router is 'UNI_PAY' */
        "requestType": "Payment",

        /* Find your MID in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys */
        "mid": MID,

        /* Find your Website Name in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys */
        "websiteName": website == undefined ? "DEFAULT" : website,

        /* Enter your unique order id */
        "orderId": orderId,

        /* on completion of transaction, we will send you the response on this URL */
        // "callbackUrl": "https://mrdishant.com",
        "callbackUrl": callbackUrl,

        /* Order Transaction Amount here */
        "txnAmount": {

            /* Transaction Amount Value */
            "value": amount,

            /* Transaction Amount Currency */
            "currency": "INR",
        },

        /* Customer Infomation here */
        "userInfo": {

            /* unique id that belongs to your customer */
            "custId": custId,
        },

    };

    console.log("Mode");
    console.log(mode);

    if (mode == "1") {
        console.log("Mode 1 So Net Banking");
        paytmParams.body[
            "enablePaymentMode"] = [{
            "mode": "NET_BANKING",
        }]
    } else if (mode == "0") {
        console.log("Mode 0 So BALANCE");
        paytmParams.body[
            "enablePaymentMode"] = [{
            "mode": "BALANCE",
        }]
    } else if (mode == "2") {
        console.log("Mode 2 So UPI");
        paytmParams.body[
            "enablePaymentMode"] = [{
            "mode": "UPI",
        }]
    } else if (mode == "3") {
        console.log("Mode 3 So CC");
        paytmParams.body[
            "enablePaymentMode"] = [{
            "mode": "CREDIT_CARD"
        }]
    }

    console.log(JSON.stringify(paytmParams));

    /**
     * Generate checksum by parameters we have in body
     * Find your Merchant Key in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys 
     */
    checksum_lib.genchecksumbystring(JSON.stringify(paytmParams.body), key_secret, (err, checksum) => {

        if (err) {
            return;
        }

        /* head parameters */
        paytmParams.head = {

            /* put generated checksum value here */
            "signature": checksum
        };

        /* prepare JSON string for request */
        var post_data = JSON.stringify(paytmParams);

        var options = {



            /* for Staging */


            /* for Production */
            hostname: testing == "0" ? 'securegw-stage.paytm.in' : 'securegw.paytm.in',

            port: 443,
            path: '/theia/api/v1/initiateTransaction?mid=' + MID + '&orderId=' + orderId,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };

        // Set up the request
        var response = "";
        var post_req = https.request(options, (post_res) => {
            post_res.on('data', (chunk) => {
                response += chunk;
            });

            post_res.on('end', () => {
                console.log(orderId);
                console.log(MID);
                console.log('Response: ', response);
                response = JSON.parse(response);
                res.send(response.body.txnToken);
                return 0;
            });
        });

        // post the data
        post_req.write(post_data);
        post_req.end();
    });
});

app.listen(port, function() {
    console.log(`Example app listening on port !`);
});
var PaytmConfig = {
  mid: "vLQkAT72546842461929",
  key: "Dc_c3tADsFaqLsEW",
  website: "WEBSTAGING"
};

var txn_url = "https://securegw-stage.paytm.in/order/process"; // for staging

var callbackURL = "https://flutter-backend-paytm.herokuapp.com/generateTxnToken/paymentReceipt";

app.post("/payment", (req, res) => {
  let paymentData = req.body;
  var params = {};
  params["MID"] = PaytmConfig.mid;
  params["WEBSITE"] = PaytmConfig.website;
  params["CHANNEL_ID"] = "WEB";
  params["INDUSTRY_TYPE_ID"] = "Retail";
  params["ORDER_ID"] = paymentData.orderID;
  params["CUST_ID"] = paymentData.custID;
  params["TXN_AMOUNT"] = paymentData.amount;
  params["CALLBACK_URL"] = callbackURL;
  params["EMAIL"] = paymentData.custEmail;
  params["MOBILE_NO"] = paymentData.custPhone;

  checksum_lib.genchecksum(params, PaytmConfig.key, (err, checksum) => {
    if (err) {
      console.log("Error: " + e);
    }

    var form_fields = "";
    for (var x in params) {
      form_fields +=
        "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
    }
    form_fields +=
      "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

    res.writeHead(200, { "Content-Type": "text/html" });
    res.write(
      '<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' +
        txn_url +
        '" name="f1">' +
        form_fields +
        '</form><script type="text/javascript">document.f1.submit();</script></body></html>'
    );
    res.end();
  });
});

app.post("/paymentReceipt", (req, res) => {
  let responseData = req.body;
  var checksumhash = responseData.CHECKSUMHASH;
  var result = checksum_lib.verifychecksum(
    responseData,
    PaytmConfig.key,
    checksumhash,
    );
  if (result) {
    return res.send({
      status: 0,
      data: responseData,
    });
  } else {
    return res.send({
      status: 1,
      data: responseData,
    });
  }
});

exports.customFunctions = functions.https.onRequest(app);