const express = require('express');
const path = require('path');

const {open} = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
const databasePath = path.join(__dirname, 'twitterClone.db');

let database = null;

const initilizeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/');
    });
  } 
  catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initilizeDbAndServer();

// Return list of All Users from user table
app.get('/users/', async (request, response) => {
  const getUsersQuery = `
    SELECT
      *
    FROM
      user;
  `;
  const usersDetails = await database.all(getUsersQuery);
  response.send(usersDetails);
});

// Return list of Followers from Follower table
app.get('/followers/', async (request, response) => {
  const getFollowersQuery = `
    SELECT
      *
    FROM
      follower;
  `;
  const followersDetails = await database.all(getFollowersQuery);
  response.send(followersDetails);
});

// Return list of Tweets from Tweet table
app.get('/tweets/', async (request, response) => {
  const getTweetsQuery = `
    SELECT
      *
    FROM
      tweet;
  `;
  const tweetsDetails = await database.all(getTweetsQuery);
  response.send(tweetsDetails);
});

// Return list of Replies from Reply  table
app.get('/replies/', async (request, response) => {
  const getRepliesQuery = `
    SELECT
      *
    FROM
      reply;
  `;
  const replyDetails = await database.all(getRepliesQuery);
  response.send(replyDetails);
});

// Return list of Likes from Like table
app.get('/likes/', async (request, response) => {
  const getLikesQuery = `
    SELECT
      *
    FROM
      like;
  `;
  const likesDetails = await database.all(getLikesQuery);
  response.send(likesDetails);
});


//API 1: User Registration
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const checkUserQuery = `
    SELECT 
      *
    FROM
      user
    WHERE 
      username = '${username}';
  `;
  const databaseUser = await database.get(checkUserQuery);

  if (databaseUser === undefined) {
    //Scenario 3:Successful registration of the registrant
    const createUserQuery = `
      INSERT INTO
        user (username, password, name, gender)
      VALUES
        (
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}'
        );                
    `;
    if (password.length > 6) {
      const createUser = await database.run(createUserQuery);
      //console.log(createUser);
      response.send('User created successfully');
    } 
    else {
      //Scenario 2: If the registrant provides a password with less than 6 characters
      response.status(400);
      response.send('Password is too short');
    }
  } 
  else {
    //Scenario 1: If the username already exists
    response.status(400);
    response.send('User already exists');
  }
});

//API 2: User Login
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkUserQuery = `
    SELECT
      *
    FROM 
      user
    WHERE
      username = '${username}';
  `;
  const databaseUser = await database.get(checkUserQuery);

  if (databaseUser === undefined) {
    //Scenario 1: If the user doesn't have a Twitter account
    response.status(400);
    response.send('Invalid user');
  } 
  else {
    const isPasswordMatched = await bcrypt.compare(password, databaseUser.password);
    if (isPasswordMatched === true) {
      // Scenario 3: Successful login of the user
      const payload = {username: username};
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN');
      response.send({jwtToken});
    } 
    else {
      // Scenario 2:If the user provides an incorrect password
      response.status(400);
      response.send('Invalid password');
    }
  }
});

// Authentication with JWT Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers['authorization'];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1];
  }
  if (authHeader === undefined) {
    // Scenario 1:If the JWT token is not provided by the user or an invalid JWT token is provided
    response.status(401);
    response.send('Invalid JWT Token');
  } 
  else {
    jwtToken = jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
      if (error) {
        response.status(401);
        response.send('Invalid JWT Token');
      } 
      else {
        //Scenario 2:After successful verification of token proceed to next middleware or handler
        //console.log(payload);
        request.username = payload.username;
        next();
      }
    })
  }
};

//API 3:Returns the latest tweets of people whom the user follows. Return 4 tweets at a time
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  /** get user id from username  */
  let {username} = request;
  //console.log(username)
  const getUserQuery = `
    SELECT 
      *
    FROM
      user
    WHERE 
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  // console.log(userDetails);

  /** get followers ids from user id  */
  const getFollowersQuery = `
    SELECT
      following_user_id
    FROM
      follower
    WHERE
      follower_user_id = ${userDetails.user_id};
  `;
  const followerIdsDetails = await database.all(getFollowersQuery);
  //console.log(followerIdsDetails);
  const followerIds = followerIdsDetails.map(eachUser => {
    return eachUser.following_user_id
  });
  //console.log(followerIds);

  const getTweetQuery = `
    SELECT 
      user.username, 
      tweet.tweet, 
      tweet.date_time as dateTime 
    FROM
     user 
    INNER JOIN
     tweet 
    ON
     user.user_id= tweet.user_id 
    where 
      user.user_id IN (${followerIds})
    ORDER BY 
      tweet.date_time DESC
    LIMIT 4;
  `;
  const data = await database.all(getTweetQuery);
  //console.log(data);
  response.send(data);
})

//API 4:Returns the list of all names of people whom the user follows
app.get('/user/following/', authenticateToken, async (request, response) => {
  let {username} = request;
  //console.log(username);
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery)
  //console.log(userDetails);
  const getFollowingUserQuery = `
    SELECT
      following_user_id
    FROM
      follower
    WHERE
      follower_user_id = ${userDetails.user_id};
  `;
  const followingUserDetails = await database.all(getFollowingUserQuery);
  //console.log(followingUserDetails);
  const followingUserIds = followingUserDetails.map(eachUser => {
    return eachUser.following_user_id
  });
  //console.log(followerIds);
  const getUserFollowings = `
    SELECT
      name
    FROM
      user
    WHERE
      user_id IN (${followingUserIds});
  `;
  const userFollowingNames = await database.all(getUserFollowings);
  response.send(userFollowingNames);
});

//API 5:Returns the list of all names of people who follows the user
app.get('/user/followers/', authenticateToken, async (request, response) => {
  let {username} = request;
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  const getFollowerUsersQuery = `
    SELECT
      follower_user_id
    FROM
      follower
    WHERE
      following_user_id = ${userDetails.user_id};
  `;
  const followerUserDetails = await database.all(getFollowerUsersQuery);
  //console.log(followerUserDetails);
  const followerUserIds = followerUserDetails.map(eachUser => {
    return eachUser.follower_user_id
  });
  //console.log(followerUserIds);
  const getUserFollowers = `
    SELECT
      name
    FROM
      user
    WHERE
      user_id IN (${followerUserIds});
  `;
  const userFollowerNames = await database.all(getUserFollowers);
  response.send(userFollowerNames);
});

//API 6:
const result = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  }
};

app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params;
  let {username} = request;
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  /** Get the Ids whom the user is following */
  const userFollowingQuery = `
    SELECT
      following_user_id 
    FROM
      follower
    WHERE
      follower_user_id = ${userDetails.user_id};
  `;
  const userFollowingDetails = await database.all(userFollowingQuery);
  const userFollowingIds = userFollowingDetails.map(eachUser => {
    return eachUser.following_user_id
  })
  //console.log(userFollowingIds);
  /** get the tweet ids of people whom the logged-in user follows */
  const getTweetIdsOfFollowers = `
    SELECT
      tweet_id
    FROM
      tweet
    WHERE
      user_id IN (${userFollowingIds});
  `;
  const tweetIdsDetails = await database.all(getTweetIdsOfFollowers);
  //console.log(tweetIdsDetails);
  const tweetIdsOfFollowers = tweetIdsDetails.map(eachUser => {
    return eachUser.tweet_id
  });
  //console.log(tweetIds);
  //console.log(tweetIds.includes(parseInt(tweetId)));
  if (tweetIdsOfFollowers.includes(parseInt(tweetId))) {
    //Scenario 2:If the user requests a tweet of the user he is following, return the tweet, likes count, replies count and date-time
    const tweetQuery = `
      SELECT 
        tweet,
        date_time 
      FROM
        tweet
      WHERE 
        tweet_id = ${tweetId};
    `;
    const tweetDetails = await database.get(tweetQuery);
    //console.log(tweetDetails);

    const likesQuery = `
      SELECT
        COUNT(user_id) AS likes
      FROM
        like
      WHERE
        tweet_id = ${tweetId};
    `;
    const likesCount = await database.get(likesQuery);
    //console.log(likesCount);

    const repliesQuery = `
      SELECT 
        COUNT(user_id) AS replies
      FROM
        reply
      WHERE
        tweet_id = ${tweetId};
    `;
    const repliesCount = await database.get(repliesQuery);
    //console.log(repliesCount);

    response.send(result(tweetDetails, likesCount, repliesCount));
  } 
  else {
    //Scenario 1:If the user requests a tweet other than the users he is following
    response.status(401);
    response.send('Invalid Request');
  }
});

//API 7:
const convertLikedUserNameDbObjectToResponseObject = dbObject => {
  return {
    likes: dbObject,
  }
};

app.get('/tweets/:tweetId/likes/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params;
  let {username} = request;
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  /** Get the Ids whom the user is following */
  const userFollowingQuery = `
    SELECT
      following_user_id 
    FROM
      follower
    WHERE
      follower_user_id = ${userDetails.user_id};
  `;
  const userFollowingDetails = await database.all(userFollowingQuery);
  const userFollowingIds = userFollowingDetails.map(eachUser => {
    return eachUser.following_user_id
  });
  //console.log(userFollowingIds);
  /** Check is the tweet ( using tweet id) made by his followers */
  const getTweetIdsOfFollowers = `
    SELECT
      tweet_id
    FROM
      tweet
    WHERE
      user_id IN (${userFollowingIds});
  `;
  const tweetIdsDetails = await database.all(getTweetIdsOfFollowers);
  //console.log(tweetIdsDetails)
  const getTweetIds = tweetIdsDetails.map(eachUser => {
    return eachUser.tweet_id
  });
  //console.log(getTweetIds);
  //console.log(getTweetIds.includes(parseInt(tweetId)));
  if (getTweetIds.includes(parseInt(tweetId))) {
    //Scenario 2:If the user requests a tweet of a user he is following, return the list of usernames who liked the tweet
    const getLikedUsersNameQuery = `
      SELECT
        user.username AS likes
      FROM 
        user
      INNER JOIN
        like
      ON user.user_id = like.user_id
      WHERE
        tweet_id = ${tweetId};
    `;
    const getLikedUserNamesArray = await database.all(getLikedUsersNameQuery);
    // console.log(getLikedUserNamesArray);
    const likedUserName = getLikedUserNamesArray.map(eachUser => {
      return eachUser.likes
    });
    //console.log(likedUserName);
    //console.log(convertLikedUserNameDbObjectToResponseObject(likedUserName));
    response.send(convertLikedUserNameDbObjectToResponseObject(likedUserName));
  } 
  else {
    //Scenario 1:If the user requests a tweet other than the users he is following
    response.status(401);
    response.send('Invalid Request');
  }
});

//API 8:
const convertReplyUserNameDbObjectToResponseObject = dbObject => {
  return {
    replies: dbObject,
  }
};

app.get('/tweets/:tweetId/replies/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params;
  let {username} = request;
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  /** Get the Ids whom the user is following */
  const userFollowingQuery = `
    SELECT
      following_user_id 
    FROM
      follower
    WHERE
      follower_user_id = ${userDetails.user_id};
  `;
  const userFollowingDetails = await database.all(userFollowingQuery);
  const userFollowingIds = userFollowingDetails.map(eachUser => {
    return eachUser.following_user_id
  });
  //console.log(userFollowingIds);
  //check if the tweet ( using tweet id) made by the person he is  following
  const getTweetIdsOfFollowers = `
    SELECT
      tweet_id
    FROM
      tweet
    WHERE
      user_id IN (${userFollowingIds});
  `;
  const tweetIdsDetails = await database.all(getTweetIdsOfFollowers);
  //console.log(tweetIdsDetails);
  const getTweetIds = tweetIdsDetails.map(eachUser => {
    return eachUser.tweet_id
  });
  //console.log(getTweetIds);
  //console.log(getTweetIds.includes(parseInt(tweetId)));
  if (getTweetIds.includes(parseInt(tweetId))) {
    //Scenario 2:If the user requests a tweet of a user he is following, return the list of replies.
    //get reply's
    /**const getTweetQuery = `
      SELECT
        tweet 
      FROM
        tweet 
      WHERE
        tweet_id=${tweetId};
    `;
    const getTweet = await database.get(getTweetQuery);
    console.log(getTweet); */
    const getUsernameReplyTweetsQuery = `
      SElECT
        user.name,
        reply.reply
      FROM
        user
      INNER JOIN 
        reply
      ON user.user_id = reply.user_id
      WHERE
        tweet_id = ${tweetId}
    `;
    const usernameReplyTweets = await database.all(getUsernameReplyTweetsQuery);
    //console.log(usernameReplyTweets);
    /* console.log(
      convertReplyUserNameDbObjectToResponseObject(usernameReplyTweets)
    );*/
    response.send(convertReplyUserNameDbObjectToResponseObject(usernameReplyTweets));
  } 
  else {
    //Scenario 1:If the user requests a tweet other than the users he is following
    response.status(401);
    response.send('Invalid Request');
  }
});

//API 9: Returns a list of all tweets of the user
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  let {username} = request;
  //console.log(username)
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  //Get  tweetId of the logged-in user
  const tweetIdQuery = `
    SELECT
      *
    FROM
      tweet
    WHERE
      user_id = ${userDetails.user_id};
  `;
  const getTweetDetails = await database.all(tweetIdQuery);
  const tweetIdsList = getTweetDetails.map(eachId => {
    return parseInt(eachId.tweet_id)
  });
  //console.log(tweetIdsList);
  //Get all the tweets of the logged-in user
  const getLikesQuery = `
    SELECT 
      COUNT(like_id) AS likes 
    FROM 
      like 
    WHERE 
      tweet_id IN (${tweetIdsList}) 
    GROUP BY tweet_id
    ORDER BY tweet_id;
  `;
  const likesObjectsList = await database.all(getLikesQuery);
  console.log(likesObjectsList);

  const getRepliesQuery = `
    SELECT 
      COUNT(reply_id) AS replies 
    FROM 
      reply 
    WHERE 
      tweet_id IN (${tweetIdsList}) 
    GROUP BY tweet_id
    ORDER BY tweet_id;
  `;
  const repliesObjectsList = await database.all(getRepliesQuery);
  console.log(repliesObjectsList);

  response.send(getTweetDetails.map((tweetObj, index) => {
    const likes = likesObjectsList[index] ? likesObjectsList[index].likes : 0
    const replies = repliesObjectsList[index] ? repliesObjectsList[index].replies : 0
    return {
      tweet: tweetObj.tweet,
      likes,
      replies,
      dateTime: tweetObj.date_time,
    }
  }));
});

//API 10: Create a tweet in the tweet table
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body;
  //console.log(tweet);
  const {username} = request;
  //console.log(username)
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  const currentDate = new Date();
  //console.log(currentDate); output: 2024-04-17T08:58:20.864Z
  //console.log(currentDate.toISOString().replace('T', ' '));
  const createTweetQuery = `
    INSERT INTO
      tweet(tweet, user_id, date_time)
    VALUES 
      (
        '${tweet}',
        '${userDetails.user_id}',
        '${currentDate}'
      );
  `;
  const createdTweet = await database.run(createTweetQuery);
  console.log(createdTweet);
  const tweet_id = createdTweet.lastID;
  response.send('Created a Tweet');
});

//API 11:
app.delete('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params;
  const {username} = request;
  //console.log(username);
  const getUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userDetails = await database.get(getUserQuery);
  //console.log(userDetails);
  const tweetIdQuery = `
    SELECT
      *
    FROM
      tweet
    WHERE
      user_id = ${userDetails.user_id};
  `;
  const getTweetDetails = await database.all(tweetIdQuery);
  const tweetIdsList = getTweetDetails.map(eachId => {
    return parseInt(eachId.tweet_id)
  });
  //console.log(tweetIdsList);
  if (tweetIdsList.includes(parseInt(tweetId))) {
    //Scenario 2: If the user deletes his tweet
    const deleteTweetIds = `
      DELETE FROM
        tweet
      WHERE
        tweet_id = ${tweetId};
    `;
    const deletedIds = await database.run(deleteTweetIds);
    response.send('Tweet Removed');
  } 
  else {
    //Scenario 1:If the user requests to delete a tweet of other users
    response.status(401);
    response.send('Invalid Request');
  }
});
module.exports = app;
