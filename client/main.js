const siteUrl = "https://insider-online.herokuapp.com";
const authorEmail = "fakeartist@gmx.com";
const authorBggUser = "alenros";
const analyticsUrl = "https://c.statcounter.com/12248875/0/f1acb2d6/1/";

Handlebars.registerHelper('toCapitalCase', function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

function initUserLanguage() {
  var language = amplify.store("language");

  if (language) {
    Session.set("language", language);
  }

  let userLanguage = getUserLanguage()
  setUserLanguage(userLanguage);
}

function getUserLanguage() {
  var language = Session.get("language");

  if (language) {
    return language;
  } else {
    return "en";
  }
};

function setUserLanguage(language) {
  TAPi18n.setLanguage(language).done(function () {
    Session.set("language", language);
    amplify.store("language", language);
  });
}

function getLanguageDirection() {
  var language = getUserLanguage()
  var rtlLanguages = ['he', 'ar'];

  if ($.inArray(language, rtlLanguages) !== -1) {
    return 'rtl';
  } else {
    return 'ltr';
  }
}

function getLanguageList() {
  var languages = TAPi18n.getLanguages();
  var languageList = _.map(languages, function (value, key) {
    var selected = "";

    if (key == getUserLanguage()) {
      selected = "selected";
    }

    // Gujarati isn't handled automatically by tap-i18n,
    // so we need to set the language name manually
    if (value.name == "gu") {
      value.name = "ગુજરાતી";
    }

    return {
      code: key,
      selected: selected,
      languageDetails: value
    };
  });

  if (languageList.length <= 1) {
    return null;
  }

  return languageList;
}

function getCurrentGame() {
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink() {
  var game = getCurrentGame();

  if (!game) {
    return;
  }

  return game.accessCode + "/";
}


function getCurrentPlayer() {
  var playerID = Session.get("playerID");

  if (playerID) {
    return Players.findOne(playerID);
  }
}

function generateAccessCode() {
  let accessCodeLength = 5;
  let accessCode = "";

  for (var i = 0; i < accessCodeLength; i++) {
    let randomDigit = Math.floor(Math.random() * 10);
    accessCode = accessCode + randomDigit;
  }

  return accessCode;
}

function generateNewGame() {
  var game = {
    accessCode: generateAccessCode(),
    state: "waitingForPlayers",
    word: null,
    lengthInMinutes: 5,
    endTime: null,
    paused: false,
    pausedTime: null
  };

  var gameID = Games.insert(game);
  game = Games.findOne(gameID);

  return game;
}

function generateNewPlayer(game, name) {
  var player = {
    gameID: game._id,
    name: name,
    category: null,
    isQuestionMaster: false,
    isInsider: false,
    isFirstPlayer: false
  };

  var playerID = Players.insert(player);

  return Players.findOne(playerID);
}

function getRandomWord() {

  let userLanguage = getUserLanguage();

  let words = [];
  switch (userLanguage) {
    case "he":
      words = words_he;
      break;
    case "en":
      words = words_en;
      break;
    case "de":
      words = words_de;
      break;
    case "ja":
      words = words_ja;
      break;
    case "fr":
      words = words_ja;
      break; 
    case "it":
      words = words_it;
      break;  	  
    default:
      words = words_en;
      break;
  };

  var wordIndex = Math.floor(Math.random() * words.length);
  return words[wordIndex];
}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function resetUserState() {
  var player = getCurrentPlayer();

  if (player) {
    Players.remove(player._id);
  }

  Session.set("gameID", null);
  Session.set("playerID", null);
}

function trackGameState() {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID) {
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player) {
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if (game.state === "inProgress") {
    Session.set("currentView", "gameView");
  } else if (game.state === "waitingForPlayers") {
    Session.set("currentView", "lobby");
  }
}

function leaveGame() {
  var player = getCurrentPlayer();
  let game = getCurrentGame();
  let currentTimeRemaining = getTimeRemaining();
  let players = Array.from(Players.find({ gameID: game._id }));
  
  let gameAnalytics = {
    gameID: game._id,
    playerCount: players.length,
    timeLeft: currentTimeRemaining/1000/60,
    status: "left game",
  };

  Analytics.insert(gameAnalytics);

  Session.set("currentView", "startMenu");
  Players.remove(player._id);

  Session.set("playerID", null);
}

function hasHistoryApi() {
  return !!(window.history && window.history.pushState);
}

initUserLanguage();

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

if (hasHistoryApi()) {
  function trackUrlState() {
    var accessCode = null;
    var game = getCurrentGame();
    if (game) {
      accessCode = game.accessCode;
    } else {
      accessCode = Session.get('urlAccessCode');
    }

    var currentURL = '/';
    if (accessCode) {
      currentURL += accessCode + '/';
    }
    window.history.pushState(null, null, currentURL);
  }
  Tracker.autorun(trackUrlState);
}
Tracker.autorun(trackGameState);

FlashMessages.configure({
  autoHide: true,
  autoScroll: false
});

Template.main.helpers({
  whichView: function () {
    return Session.get('currentView');
  },
  language: function () {
    return getUserLanguage();
  },
  textDirection: function () {
    return getLanguageDirection();
  }
});

Template.footer.helpers({
  authorEmail: function() {
    return authorEmail;
  },
  authorBggUsername: function() {
    return authorBggUser;
  },
  languages: getLanguageList
})

Template.footer.events({
  'click .btn-set-language': function (event) {
    var language = $(event.target).data('language');
    setUserLanguage(language);
  },
  'change .language-select': function (event) {
    var language = event.target.value;
    setUserLanguage(language);
  }
})

Template.startMenu.events({
  'click #btn-new-game': function () {
    Session.set("currentView", "createGame");
    let referrer  = document.referrer;
    let referrerAnalytics = {
      cameFrom: referrer,
      action: "New Game"
    };

    Analytics.insert(referrerAnalytics);
    
  },
  'click #btn-join-game': function () {
    let referrer  = document.referrer;
    let referrerAnalytics = {
        cameFrom: referrer,
        action: "Join Game",
    };

    Analytics.insert(referrerAnalytics);

    Session.set("currentView", "joinGame");
  }
});

Template.startMenu.helpers({
  alternativeURL: function () {
    return Meteor.settings.public.alternative;
  }
});

Template.startMenu.rendered = function () {
  let referrer  = document.referrer;
  let referrerAnalytics = {
      cameFrom: referrer,
  };

  Analytics.insert(referrerAnalytics);
 
  resetUserState();
};

Template.createGame.events({
  'submit #create-game': function (event) {

    var playerName = event.target.playerName.value;

    if (!playerName) {
      return false;
    }

    var game = generateNewGame();
    var player = generateNewPlayer(game, playerName);

    Meteor.subscribe('games', game.accessCode);

    Session.set("loading", true);

    Meteor.subscribe('players', game._id, function onReady() {
      Session.set("loading", false);

      Session.set("gameID", game._id);
      Session.set("playerID", player._id);
      Session.set("currentView", "lobby");
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.createGame.helpers({
  isLoading: function () {
    return Session.get('loading');
  }
});

Template.createGame.rendered = function (event) {
  $("#player-name").focus();
};

Template.joinGame.events({
  'submit #join-game': function (event) {
    var accessCode = event.target.accessCode.value;
    var playerName = event.target.playerName.value;

    if (!playerName) {
      return false;
    }

    accessCode = accessCode.trim();
    accessCode = accessCode.toLowerCase();

    Session.set("loading", true);

    Meteor.subscribe('games', accessCode, function onReady() {
      Session.set("loading", false);

      var game = Games.findOne({
        accessCode: accessCode
      });
      if (game) {
        Meteor.subscribe('players', game._id);
        player = generateNewPlayer(game, playerName);

        Session.set('urlAccessCode', null);
        Session.set("gameID", game._id);
        Session.set("playerID", player._id);
        Session.set("currentView", "lobby");
      } else {
        FlashMessages.sendError(TAPi18n.__("ui.invalid access code"));
      }
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set('urlAccessCode', null);
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.joinGame.helpers({
  isLoading: function () {
    return Session.get('loading');
  }
});


Template.joinGame.rendered = function (event) {
  resetUserState();
  let referrer  = document.referrer;
  let referrerAnalytics = {
      cameFrom: referrer,
      action: "Join Game",
  };

  Analytics.insert(referrerAnalytics);

  var urlAccessCode = Session.get('urlAccessCode');

  if (urlAccessCode) {
    $("#access-code").val(urlAccessCode);
    $("#access-code").hide();
    $("#player-name").focus();
  } else {
    $("#access-code").focus();
  }
};

Template.lobby.helpers({
  siteUrl: function() {
    return siteUrl;
  },
  game: function () {
    return getCurrentGame();
  },
  accessLink: function () {
    return getAccessLink();
  },
  player: function () {
    return getCurrentPlayer();
  },
  players: function () {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    var players = Players.find({ 'gameID': game._id }, { 'sort': { 'createdAt': 1 } }).fetch();

    players.forEach(function (player) {
      if (player._id === currentPlayer._id) {
        player.isCurrent = true;
      }
    });

    return players;
  }
});

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-submit-user-word': function (event) {
    var game = getCurrentGame();
    var word = document.getElementById("user-word").value;
    let questionMaster = getCurrentPlayer();
    var players = Array.from(Players.find({ gameID: game._id }));
    let regularPlayers = players.filter(p => p._id != questionMaster._id);
    var localEndTime = moment().add(game.lengthInMinutes, 'minutes');
    var gameEndTime = TimeSync.serverTime(localEndTime);

    if(players.length < 4)
    {
        console.log("firing error");
        FlashMessages.sendError("Can't play with less than 4 players");
        return;
    }

    UserWords.insert(word);

    var chosenIndexes = []

    // The special roles in the game are the Insider and the Question Master. This may change when an Informer role is added.
    let specialRoles = 1;

    let shouldAddFollowerRole = document.getElementById("use-follower-variant").checked;
    if(shouldAddFollowerRole == true){
      specialRoles = specialRoles + 1;
    }

    let playerIndexesLeft = []

    // Distributing the roles:
    let i = 0;
    while (playerIndexesLeft.length < players.length) {
      playerIndexesLeft.push(i);
      i = i + 1;
    }

    // Get a player index for each special role, unless there are less players than special roles.
    // Having less players than special roles makes the game unplayable, but allowing it let's players test the game.
    // This could be removed if the user would get a UI hint that they need more players.
    while (chosenIndexes.length < specialRoles && players.length > specialRoles) {
      let r = Math.floor(Math.random() * playerIndexesLeft.length);
      let chosenPlayerIndex = playerIndexesLeft[r];
      chosenIndexes.push(chosenPlayerIndex);

      playerIndexesLeft.splice(chosenPlayerIndex, 1);
    }

    var insiderIndex = chosenIndexes[0];
    let followerIndex;
    if(shouldAddFollowerRole){
      followerIndex = chosenIndexes[1];
    }

    let currentInsiderName ="";

    var firstPlayerIndex = Math.floor(Math.random() * regularPlayers.length);

    regularPlayers.forEach(function (player, index) {
      Players.update(player._id, {
        $set: {
          isQuestionMaster: false,
          isInsider: index === insiderIndex,
          isFollower: index === followerIndex,
          isFirstPlayer: index === firstPlayerIndex
        }
      });
      if(index === insiderIndex){
        currentInsiderName = player.name
      };
    });

    regularPlayers.forEach(function (player) {
      Players.update(player._id, { $set: { word: word } });
    });

    Players.update(questionMaster._id, { $set: { word: word } });

    let shouldPlayAllInsiderVariant = document.getElementById("use-all-insiders-variant").checked;

    let percentEveryoneIsAnInsider = 10;
    let isEveryoneAnInsider = Math.floor(Math.random() * 100) < percentEveryoneIsAnInsider;

    if(shouldPlayAllInsiderVariant === true && isEveryoneAnInsider === true){
      players.forEach(function (player) {
        if(player.isQuestionMaster === false){
          Players.update(player._id, {
            $set: {
              isInsider: true,
              // Can't have a follower in an all-insider game
              isFollower: false,
            }
          });
        }
      });
    }

    Players.update(questionMaster._id, {
      $set: {
        isQuestionMaster: true,
        isInsider: false,
        isFirstPlayer: false
      }
    });

    let variantsUsed = [];
    if(shouldAddFollowerRole === true){
      variantsUsed.push("follower");
    }
    if(shouldPlayAllInsiderVariant === true){
      variantsUsed.push("all-insiders");
    }
    
    // Track game analytics
    let gameAnalytics = {
      gameID: game._id,
      playerCount: players.length,
      gameType: "user-word",
      language: Session.get("language"),
      variants: variantsUsed,
      word: word,
    };

    Analytics.insert(gameAnalytics);

    Games.update(game._id, { $set: { state: 'inProgress', word: word, endTime: gameEndTime, paused: false, pausedTime: null,insiderName: currentInsiderName, usingFollowerVariant: shouldAddFollowerRole, usingAllInsidersVaraint: shouldPlayAllInsiderVariant } });
  },
  'click #copyAccessLinkImg': function () {
    let accessLink = siteUrl + "/" + getAccessLink();

    const textArea = document.createElement("textarea");
    textArea.value = accessLink;
    document.body.appendChild(textArea);
    textArea.select();

    document.execCommand("copy");
    document.body.removeChild(textArea);

    var tooltip = document.getElementById("copyAccessLinkTooltip");
    tooltip.innerHTML = "Copied!";
  },
  'mouseout #copyAccessLinkImg': function () {
    var tooltip = document.getElementById("copyAccessLinkTooltip");
    // TODO revert the text using the translated string
    // tooltip.innerHTML = "Copy link";
  },
  'click .btn-start': function () {

    var game = getCurrentGame();
    var word = getRandomWord().text;
    var players = Players.find({ gameID: game._id });
    var localEndTime = moment().add(game.lengthInMinutes, 'minutes');
    var gameEndTime = TimeSync.serverTime(localEndTime);

    let playerIndexesLeft = []

    // Distributing the roles: 
    let i = 0;
    while (playerIndexesLeft.length < players.count()) {
      playerIndexesLeft.push(i);
      i = i + 1;
    }

    var chosenIndexes = []

    // The special roles in the game are the Insider and the Question Master. This may change when an Informer role is added.
    let specialRoles = 2;

    let shouldAddFollowerRole = document.getElementById("use-follower-variant").checked;
    if(shouldAddFollowerRole === true){
      specialRoles = specialRoles + 1;
    }

    // Get a player index for each special role, unless there are less players than special roles.
    // Having less players than special roles makes the game unplayable, but allowing it let's players test the game.
    // This could be removed if the user would get a UI hint that they need more players.
    while (chosenIndexes.length < specialRoles && players.count() > specialRoles) {
      let r = Math.floor(Math.random() * playerIndexesLeft.length);
      let chosenPlayerIndex = playerIndexesLeft[r];
      chosenIndexes.push(chosenPlayerIndex);

      playerIndexesLeft.splice(chosenPlayerIndex, 1);
    }

    var insiderIndex = chosenIndexes[0];
    var questionMasterIndex = chosenIndexes[1];
    let followerIndex;
    if(shouldAddFollowerRole){
      followerIndex = chosenIndexes[2];
    }

    let currentInsiderName ="";

    players.forEach(function (player, index) {
      Players.update(player._id, {
        $set: {
          isQuestionMaster: index === questionMasterIndex,
          isInsider: index === insiderIndex,
          isFollower: index === followerIndex,
        }
      });
      
      if(index === insiderIndex){
        currentInsiderName = player.name
      };

    });

    let shouldPlayAllInsiderVariant = document.getElementById("use-all-insiders-variant").checked;

    let percentEveryoneIsAnInsider = 10;
    let isEveryoneAnInsider = Math.floor(Math.random() * 100) < percentEveryoneIsAnInsider;

    if(shouldPlayAllInsiderVariant === true && isEveryoneAnInsider === true){
      players.forEach(function (player) {
        if(player.isQuestionMaster === false){
          Players.update(player._id, {
            $set: {
              isInsider: true,
              // Can't have a follower in an all-insider game
              isFollower: false,
            }
          });
        }
      });
    }
    
    let variantsUsed = [];
    if(shouldAddFollowerRole === true){
      variantsUsed.push("follower");
    }
    if(shouldPlayAllInsiderVariant === true){
      variantsUsed.push("all-insiders");
    }

    // Track game analytics
    let gameAnalytics = {
      gameID: game._id,
      playerCount: players.length,
      gameType: "game-word",
      language: Session.get("language"),
      languageType: "Chosen",
      variants: variantsUsed,
    };

    Analytics.insert(gameAnalytics);

    players.forEach(function (player) {
      Players.update(player._id, { $set: { word: word } });
    });

    Games.update(game._id, { $set: { state: 'inProgress', word: word, endTime: gameEndTime, paused: false, pausedTime: null, insiderName: currentInsiderName, usingFollowerVariant: shouldAddFollowerRole, usingAllInsidersVaraint: shouldPlayAllInsiderVariant} });
  },
  'click .btn-toggle-qrcode': function () {
    $(".qrcode-container").toggle();
  },
  'click .btn-remove-player': function (event) {
    var playerID = $(event.currentTarget).data('player-id');
    Players.remove(playerID);
  },
  'click .btn-edit-player': function (event) {
    var game = getCurrentGame();
    resetUserState();
    Session.set('urlAccessCode', game.accessCode);
    Session.set('currentView', 'joinGame');
  }
});

Template.lobby.rendered = function (event) {
  var url = siteUrl + "/" + getAccessLink();
  var qrcodesvg = new Qrcodesvg(url, "qrcode", 250);
  qrcodesvg.draw();
};

function getTimeRemaining() {
  var game = getCurrentGame();
  var localEndTime = game.endTime - TimeSync.serverOffset();
  let timeRemaining;
  if (game.paused) {
    var localPausedTime = game.pausedTime - TimeSync.serverOffset();
    timeRemaining = localEndTime - localPausedTime;
  } else {
    timeRemaining = localEndTime - Session.get('time');
  }

  if (timeRemaining < 0) {
    timeRemaining = 0;
  }

  return timeRemaining;
}

Template.gameView.helpers({
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();

    if (!game) {
      return null;
    }

    var players = Players.find({
      'gameID': game._id
    });

    return players;
  },
  words: function () {
    return words_en;
  },
  gameFinished: function () {
    var timeRemaining = getTimeRemaining();

    return timeRemaining === 0;
  },
  timeRemaining: function () {
    var timeRemaining = getTimeRemaining();

    return moment(timeRemaining).format('mm[<span>:</span>]ss');
  }
});

Template.gameView.events({
  'click .btn-leave': leaveGame,
  'click .btn-end': function () {
    let game = getCurrentGame();
    Games.update(game._id, { $set: { state: 'waitingForPlayers'} });

    let currentTimeRemaining = getTimeRemaining();

    let players = Array.from(Players.find({ gameID: game._id }));
  
    let gameAnalytics = {
      gameID: game._id,
      playerCount: players.length,
      timeLeft: currentTimeRemaining/1000/60,
      status: "game ended",
    };
  
    Analytics.insert(gameAnalytics);
  },
  'click .btn-word-guessed': function () {
    // TODO Disable the button for everyone, grey out the button, Flip hourglass for everyone
    // TODO ensure it gets enabled on the next round
    let hourglassImage = document.getElementById('hourglass');
    hourglassImage.src = "/icons/hourglass-end.svg";
    
    // The time left is the game time (5 minutes, here in seconds) minus the time passed.
    // This means you have the same time to guess the who the Insider is as you have took to guess the word.
    var game = getCurrentGame();
    var localEndTime = game.endTime - TimeSync.serverOffset();
    let timeRemaining = localEndTime - Session.get('time');
    let newTimeLeftInSeconds = 0;
    // Don't flip a negative timer - the game is over.
    if (timeRemaining > 0) {
      newTimeLeftInSeconds = ((5 * 60 * 1000) - timeRemaining) / 1000;
    }
    var localEndTime = moment().add(newTimeLeftInSeconds, 'seconds');
    var gameEndTime = TimeSync.serverTime(localEndTime);
    Games.update(game._id, { $set: { paused: false, pausedTime: null, endTime: gameEndTime } });
    
    var players = Array.from(Players.find({ gameID: game._id }));
    let gameAnalytics = {
      gameID: game._id,
      playerCount: players.length,
      timeLeft: timeRemaining/1000/60,
      sandtimer: "flipped",
      word: game.word,
    };
  
    Analytics.insert(gameAnalytics);
  },
  'click .btn-toggle-status': function () {
    $(".status-container-content").toggle();
  },
  'click .game-countdown': function () {
    var game = getCurrentGame();
    var currentServerTime = TimeSync.serverTime(moment());

    if (game.paused) {
      var newEndTime = game.endTime - game.pausedTime + currentServerTime;
      Games.update(game._id, { $set: { paused: false, pausedTime: null, endTime: newEndTime } });
    } else {
      Games.update(game._id, { $set: { paused: true, pausedTime: currentServerTime } });
    }
  }
});