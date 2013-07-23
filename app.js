var util = require('util'),
  express = require('express'),
  path = require('path'),
  googleapis = require('googleapis'),
  moment = require('moment'),
  settings = {
    server: {
      hostname: 'mktgdept.com',
      port: '5555'
    },
    google: {
      client_id: '000000000000.apps.googleusercontent.com',
      client_secret: 'bbbbbbbbbbbbbbbbbbbbbbbb'
    }
  },
  numberFormat = function(num) {
    var parts = num.toString().split('.');
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[1] ? '.' + parts[1] : '');
  },
  template = function(title, totals) {
    var data = {
      pageviews: parseInt(totals[0]),
      clicks: parseInt(totals[1]),
      ctr: parseFloat(totals[2] * 100).toFixed(2),
      earnings: parseFloat(totals[3]).toFixed(2)
    };
    return '<article><section><table class="text-auto-size"><tbody><tr><td>Pageviews</td><td class="align-right">' + numberFormat(data.pageviews) + '</td></tr><tr><td>Clicks</td><td class="align-right">' + numberFormat(data.clicks) + '</td></tr><tr><td>CTR</td><td class="align-right">' + numberFormat(data.ctr) + '%</td></tr><tr><td>Earnings</td><td class="align-right">$' + numberFormat(data.earnings) + '</td></tr></tbody></table></section><footer><p class="yellow">' + title + '</p></footer></article>';
  },
  updateEarnings = function(itemId, isPinned) {
    googleapis.discover('mirror', 'v1').discover('adsense', 'v1.3').execute(function(err, client) {
      client.adsense.accounts.list().withAuthClient(oauth2Client).execute(function(err, results) {
        console.log('client.adsense.accounts.list', util.inspect(results));
        var accountId = results.items[0].id, date = new Date();
        client
          .newBatchRequest()
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment().format('YYYY-MM-DD'),
            endDate: moment().format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment().subtract('days', 1).format('YYYY-MM-DD'),
            endDate: moment().subtract('days', 1).format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment().subtract('days', 7).format('YYYY-MM-DD'),
            endDate: moment().subtract('days', 1).format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment().subtract('days', 30).format('YYYY-MM-DD'),
            endDate: moment().subtract('days', 1).format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment(new Date(date.getFullYear(), date.getMonth(), 1)).format('YYYY-MM-DD'),
            endDate: moment().format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .add(client.adsense.accounts.reports.generate({
            accountId: accountId,
            startDate: moment(new Date(date.getFullYear(), date.getMonth() - 1, 1)).format('YYYY-MM-DD'),
            endDate: moment(new Date(date.getFullYear(), date.getMonth(), 0)).format('YYYY-MM-DD'),
            metric: [ 'AD_REQUESTS', 'CLICKS', 'AD_REQUESTS_CTR', 'EARNINGS' ]
          }))
          .withAuthClient(oauth2Client)
          .execute(function(err, results) {
            var
              card = {
                htmlPages: [],
                isPinned: isPinned,
                menuItems: [
                  {
                    id: 'refresh',
                    action: 'CUSTOM',
                    values: [
                      {
                        displayName: 'Refresh',
                        iconUrl: 'http://' + settings.server.hostname + ':' + settings.server.port + '/refresh.png'
                      }
                    ]
                  },
                  {
                    action: 'TOGGLE_PINNED'
                  },
                  {
                    action: 'DELETE'
                  }
                ]
              },
              result;
            if(results[0].totals) {
              card.html = template('AdSense', results[0].totals);
              card.htmlPages.push(template('Today', results[0].totals));
              if(results[1].totals)
                card.htmlPages.push(template('Yesterday', results[1].totals));
              if(results[2].totals)
                card.htmlPages.push(template('Last 7 days', results[2].totals));
              if(results[3].totals)
                card.htmlPages.push(template('Last 30 days', results[3].totals));
              if(results[4].totals)
                card.htmlPages.push(template('This Month', results[4].totals));
              if(results[5].totals)
                card.htmlPages.push(template('Last Month', results[5].totals));
              if(itemId)
                client.mirror.newRequest('mirror.timeline.update', { id: itemId }, card).withAuthClient(oauth2Client).execute(function(err, result) {
                  console.log('mirror.timeline.update', util.inspect(result));
                });
              else
                client.mirror.newRequest('mirror.timeline.insert', null, card).withAuthClient(oauth2Client).execute(function(err, result) {
                  console.log('mirror.timeline.insert', util.inspect(result));
                });
            }
          });
        });
    });
  },
  OAuth2Client = googleapis.OAuth2Client,
  oauth2Client,
  app = express();

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  if(!oauth2Client || !oauth2Client.credentials) {
    oauth2Client = new OAuth2Client(settings.google.client_id, settings.google.client_secret, 'http://' + settings.server.hostname + ':' + settings.server.port + '/oauth2callback');
    res.redirect(oauth2Client.generateAuthUrl({
      access_type: 'offline',
      approval_prompt: 'force',
      scope: [
        'https://www.googleapis.com/auth/glass.timeline',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/adsense.readonly'
      ].join(' ')
    }));
  }
  else {
    googleapis.discover('mirror', 'v1').execute(function(err, client) {
      client.mirror.withAuthClient(oauth2Client).newRequest('mirror.subscriptions.insert', null, {
        callbackUrl: 'https://mirrornotifications.appspot.com/forward?url=http://' + settings.server.hostname + ':' + settings.server.port + '/subcallback',
        collection: 'timeline'
      }).execute(function(err, result) {
        console.log('mirror.subscriptions.insert', util.inspect(result));
      });
      updateEarnings();
    });
    res.send(200);
  }
});

app.get('/oauth2callback', function(req, res) {
  if(!oauth2Client) {
    res.redirect('/');
  }
  else {
    oauth2Client.getToken(req.query.code, function(err, tokens) {
      oauth2Client.credentials = tokens;
      res.redirect('/');
    });
  }
});

app.post('/subcallback', function(req, res) {
  res.send(200);
  console.log('/subcallback', util.inspect(req.body));
  if(req.body.operation == 'UPDATE' && req.body.userActions[0].type == 'CUSTOM')
    googleapis.discover('mirror', 'v1').execute(function(err, client) {
      client.mirror.timeline.get({ id: req.body.itemId }).withAuthClient(oauth2Client).execute(function(err, result) {
        console.log('mirror.timeline.get', util.inspect(result));
        updateEarnings(result.id, result.isPinned);
      });
    });
});

app.listen(settings.server.port);