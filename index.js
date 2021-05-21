const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Chatkit = require('@pusher/chatkit-server');
const PushNotifications = require('@pusher/push-notifications-server');
require('dotenv').config();

const crypto = require('crypto');

const Pusher = require('pusher');

var pusher = new Pusher({
  // connect to pusher
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_APP_KEY,
  secret: process.env.PUSHER_APP_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
});//Need to do this


const app = express();


app.use(cors());


app.post('/pusher/auth', function(req, res) {
  var socketId = req.body.socket_id;
  var channel = req.body.channel_name;
  var auth = pusher.authenticate(socketId, channel);
  res.send(auth);
});

app.get('/foods/:query?', (req, res) => {
  const foods_r = foods();

  if (req.query.query != undefined) {
    const query = req.query.query.toLowerCase();
    return res.send({
      foods: foods_r.filter(
        itm =>
          itm.name.toLowerCase().includes(query) ||
          itm.restaurant.toLowerCase().includes(query),
      ),
    });
  }

  return res.send({
    foods: foods_r,
  });
});

app.post('/login', async (req, res) => {
  const {user_id, user_name, user_type} = req.body;
  const user = await getUser(user_id);

  if (!user) {
    await chatkit.createUser({
      id: user_id,
      name: user_name,
      customData: {
        user_type,
      },
    });
  }

  return res.send('ok');
});

app.post('/room', async (req, res) => {
  const {room_id, room_name, user_id} = req.body;

  try {
    const room = await chatkit.getRoom({
      roomId: room_id,
      includePrivate: true,
    });

    if (room) {
      const user_rooms = await chatkit.getUserRooms({
        userId: user_id,
      });

      const room_index = user_rooms.findIndex(item => item.id == room_id);
      if (room_index == -1) {
        const add_user_to_room = await chatkit.addUsersToRoom({
          roomId: room_id,
          userIds: [user_id],
        });
      }
    }
  } catch (err) {
    if (err.error == 'services/chatkit/not_found/room_not_found') {
      await chatkit.createRoom({
        id: room_id,
        creatorId: user_id,
        name: room_name,
        isPrivate: true,
      });
    }
  }

  return res.send('ok');
});

app.post('/push/:order_id', async (req, res) => {
  const {data, push_type} = req.body;
  const {order_id} = req.params;

  const user_type = push_type.split('_')[0];

  const push_data = push_types[push_type];
  const title = push_data.title;
  const body = push_data.body.replace('[data]', data);

  await publishNotification(user_type, order_id, title, body);

  return res.send('ok');
});

app.post('/notify', (req, res) => {
  if (verifyRequest(req)) {
    const data = JSON.parse(req.body);
    const type = data.metadata.event_type;
    if (type == 'v1.messages_created') {
      notifyUser(data);
    }
    res.sendStatus(200);
  } else {
    console.log('Unverified request');
    res.sendStatus(401); // unauthorized
  }
});

const PORT = 8005;
app.listen(PORT, err => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Running on ports ${PORT}`);
  }
});
