Handlebars.registerHelper('toCapitalCase', function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

function initUserLanguage() {
  var language = amplify.store("language");

  if (language){
    Session.set("language", language);
  }

  setUserLanguage(getUserLanguage());
}

function getUserLanguage() {
  var language = Session.get("language");

  if (language){
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
  var languageList = _.map(languages, function(value, key) {
    var selected = "";
    
    if (key == getUserLanguage()){
      selected = "selected";
    }

    // Gujarati isn't handled automatically by tap-i18n,
    // so we need to set the language name manually
    if (value.name == "gu"){
        value.name = "ગુજરાતી";
    }

    return {
      code: key,
      selected: selected,
      languageDetails: value
    };
  });
  
  if (languageList.length <= 1){
    return null;
  }
  
  return languageList;
}

function getCurrentGame(){
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink(){
  var game = getCurrentGame();

  if (!game){
    return;
  }

  return game.accessCode + "/";
}


function getCurrentPlayer(){
  var playerID = Session.get("playerID");

  if (playerID) {
    return Players.findOne(playerID);
  }
}

function generateAccessCode(){
  var code = "";
  var possible = "abcdefghijklmnopqrstuvwxyz";
  code = getRandomWord().text + "-" + getRandomWord().text;
  
  return code;
}

function generateNewGame(){
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

function generateNewPlayer(game, name){
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

function getRandomWord(){

  let userLanguage = getUserLanguage();
	if(userLanguage == "he")
	{
    var wordIndex = Math.floor(Math.random() * words_he.length);
	  return words_he[wordIndex];
	}
	else if(userLanguage == "en")
	{
    var wordIndex = Math.floor(Math.random() * words_en.length);
	  return words_en[wordIndex];
  }
  else if(userLanguage == "ja")
  {
    var wordIndex = Math.floor(Math.random() * words_ja.length);
	  return words_ja[wordIndex];
  }
  else if(userLanguage == "fr")
  {
    var wordIndex = Math.floor(Math.random() * words_fr.length);
	  return words_fr[wordIndex];
  }
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

function resetUserState(){
  var player = getCurrentPlayer();

  if (player){
    Players.remove(player._id);
  }

  Session.set("gameID", null);
  Session.set("playerID", null);
}

function trackGameState () {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID){
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player){
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if(game.state === "inProgress"){
    Session.set("currentView", "gameView");
  } else if (game.state === "waitingForPlayers") {
    Session.set("currentView", "lobby");
  }
}

function leaveGame () {  
  var player = getCurrentPlayer();

  Session.set("currentView", "startMenu");
  Players.remove(player._id);

  Session.set("playerID", null);
}

function hasHistoryApi () {
  return !!(window.history && window.history.pushState);
}

initUserLanguage();

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

if (hasHistoryApi()){
  function trackUrlState () {
    var accessCode = null;
    var game = getCurrentGame();
    if (game){
      accessCode = game.accessCode;
    } else {
      accessCode = Session.get('urlAccessCode');
    }
    
    var currentURL = '/';
    if (accessCode){
      currentURL += accessCode+'/';
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
  whichView: function() {
    return Session.get('currentView');
  },
  language: function() {
    return getUserLanguage();
  },
  textDirection: function() {
    return getLanguageDirection();
  }
});

Template.footer.helpers({
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
  },
  'click #btn-join-game': function () {
    Session.set("currentView", "joinGame");
  }
});

Template.startMenu.helpers({
  alternativeURL: function() {
    return Meteor.settings.public.alternative;
  }
});

Template.startMenu.rendered = function () {
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
    
    Meteor.subscribe('players', game._id, function onReady(){
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
  isLoading: function() {
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

    Meteor.subscribe('games', accessCode, function onReady(){
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
  isLoading: function() {
    return Session.get('loading');
  }
});


Template.joinGame.rendered = function (event) {
  resetUserState();

  var urlAccessCode = Session.get('urlAccessCode');

  if (urlAccessCode){
    $("#access-code").val(urlAccessCode);
    $("#access-code").hide();
    $("#player-name").focus();
  } else {
    $("#access-code").focus();
  }
};

Template.lobby.helpers({
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

    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    players.forEach(function(player){
      if (player._id === currentPlayer._id){
        player.isCurrent = true;
      }
    });

    return players;
  }
});

Template.lobby.events({
  'click .btn-leave': leaveGame,
	'click .btn-submit-user-word': function(event){
    var game = getCurrentGame();
    var word = document.getElementById("user-word").value;
    var questionMasterId = $(event.currentTarget).data('player-id');
    var questionMaster = Players.findOne({_id: questionMasterId});
    var players = Array.from(Players.find({gameID: game._id},{_id:{$ne:questionMasterId}}));
    players = players.filter(p=>p._id != questionMasterId);
    var localEndTime = moment().add(game.lengthInMinutes, 'minutes');
    var gameEndTime = TimeSync.serverTime(localEndTime);
    
    var insiderIndex = Math.floor(Math.random() * players.length);
    var firstPlayerIndex = Math.floor(Math.random() * players.length);

    players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isQuestionMaster: false,
        isInsider: index === insiderIndex,
        isFirstPlayer: index === firstPlayerIndex
      }});
    });

    Players.update(questionMasterId, {$set: {
      isQuestionMaster: true,
      isInsider: false,
      isFirstPlayer: false
    }});

      players.forEach(function(player){
        Players.update(player._id, {$set: {word: word}});
      });

      Players.update(questionMasterId, {$set: {word: word}});

      Games.update(game._id, {$set: {state: 'inProgress', word: word, endTime: gameEndTime, paused: false, pausedTime: null}});
    },
    
  'click .btn-start': function () {

    var game = getCurrentGame();
    var word = getRandomWord().text;
    var players = Players.find({gameID: game._id});
    var localEndTime = moment().add(game.lengthInMinutes, 'minutes');
    var gameEndTime = TimeSync.serverTime(localEndTime);

    let playerIndexesLeft = []

    // Distributing the roles: 
    let i =0;
    while(playerIndexesLeft.length < players.count()){
      playerIndexesLeft.push(i);
      i = i + 1;
    }
    
    var chosenIndexes = []

    // The special roles in the game are the Insider and the Question Master. This may change when an Informer role is added.
    let specialRoles = 2;

    // Get a player index for each special role, unless there are less players than special roles.
    // Having less players than special roles makes the game unplayable, but allowing it let's players test the game.
    // This could be removed if the user would get a UI hint that they need more players.
    while(chosenIndexes.length < specialRoles && players.count() > specialRoles){
      let r = Math.floor(Math.random() * playerIndexesLeft.length);
      let chosenPlayerIndex = playerIndexesLeft[r];
      chosenIndexes.push(chosenPlayerIndex);
      
      playerIndexesLeft.splice(chosenPlayerIndex, 1);
    }

    var insiderIndex = chosenIndexes[0];
    var questionMasterIndex = chosenIndexes[1];

    players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isQuestionMaster: index === questionMasterIndex,
        isInsider: index === insiderIndex
        }});
    });

    players.forEach(function(player){
      Players.update(player._id, {$set: {word: word}});
    });

    Games.update(game._id, {$set: {state: 'inProgress', word: word, endTime: gameEndTime, paused: false, pausedTime: null}});
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
  var url = getAccessLink();
  url = "https://insider-online.herokuapp.com/"+url;
  var qrcodesvg = new Qrcodesvg(url, "qrcode", 250);
  qrcodesvg.draw();
};

function getTimeRemaining(){
  var game = getCurrentGame();
  var localEndTime = game.endTime - TimeSync.serverOffset();

  if (game.paused){
    var localPausedTime = game.pausedTime - TimeSync.serverOffset();
    var timeRemaining = localEndTime - localPausedTime;
  } else {
    var timeRemaining = localEndTime - Session.get('time');
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
    
    if (!game){
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
    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'waitingForPlayers'}});
  },
  'click .btn-word-guessed': function () {
    // TODO Disable the button for everyone, grey out the button, Flip hourglass for everyone
    // TODO ensure it gets enabled on the next round
    let hourglass = document.getElementById('hourglass');
    hourglass.className = "fa fa-hourglass-end";

    // The time left is the game time (5 minutes, here in seconds) minus the time passed.
    // This means you have the same time to guess the who the Insider is as you have took to guess the word.
    var game = getCurrentGame();
    var localEndTime = game.endTime - TimeSync.serverOffset();
    let timeRemaining = localEndTime - Session.get('time');
    var newTimeLeftInSeconds = ((5*60*1000) - timeRemaining) / 1000;
    var localEndTime = moment().add(newTimeLeftInSeconds, 'seconds');
    var gameEndTime = TimeSync.serverTime(localEndTime);
    Games.update(game._id, {$set: {paused: false, pausedTime: null, endTime: gameEndTime}});
  },
  'click .btn-toggle-status': function () {
    $(".status-container-content").toggle();
  },
  'click .game-countdown': function () {
    var game = getCurrentGame();
    var currentServerTime = TimeSync.serverTime(moment());

    if(game.paused){
      var newEndTime = game.endTime - game.pausedTime + currentServerTime;
      Games.update(game._id, {$set: {paused: false, pausedTime: null, endTime: newEndTime}});
    } else {
      Games.update(game._id, {$set: {paused: true, pausedTime: currentServerTime}});
    }
  }
});