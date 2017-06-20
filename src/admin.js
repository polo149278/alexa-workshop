var aws = require("aws-sdk");

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function(event, context) {
  try {
    console.log("event.session.application.applicationId=" + event.session.application.applicationId);

    if (event.session.new) {
      onSessionStarted({
        requestId: event.request.requestId}, event.session);
    }

    if (event.request.type === "LaunchRequest") {
      onLaunch(event.request,event.session,
        function callback(sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === "IntentRequest") {
      onIntent(event.request,
        event.session,
        function callback(sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === "SessionEndedRequest") {
      onSessionEnded(event.request, event.session);
      context.succeed();
    }
  } catch (e) {
    context.fail("Exception: " + e);
  }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
  console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
    ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
  console.log("onLaunch requestId=" + launchRequest.requestId +
    ", sessionId=" + session.sessionId);
    
  // Dispatch to your skill's launch.
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
  console.log("onIntent requestId=" + intentRequest.requestId +
    ", sessionId=" + session.sessionId);

  var intent = intentRequest.intent,
    intentName = intentRequest.intent.name;

  if ("InstanceCountIntent" === intentName) {
    getInstanceCount(intent, session, callback);
  } else if ("SetRegionIntent" === intentName) {
    setRegion(intent, session, callback);
  } else if ("GetRegionIntent" === intentName) {
    getRegion(intent, session, callback);
  } else if ("TerminateUntaggedInstancesIntent" === intentName) {
    terminateUntaggedInstances(intent, session, callback);
  } else if ("AMAZON.HelpIntent" === intentName) {
    getWelcomeResponse(callback);
  } else {
    throw "Invalid intent";
  }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
  console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
    ", sessionId=" + session.sessionId);
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
  // If we wanted to initialize the session to have some attributes we could add those here.
  var sessionAttributes = {};
  var cardTitle = "Alexa AWS Admin";
  var speechOutput = "Welcome to the Alexa AWS Administration Center. " +
    "Select a region to use by saying, set the region to Virginia.";
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  var repromptText = "Select a region by saying, set the region to Virginia.";
  var shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/**
 * Sets the region in the session and prepares the speech to reply to the user.
 */
function setRegion(intent, session, callback) {
  var cardTitle = intent.name;
  var selectedRegionSlot = intent.slots.Region;
  var repromptText = "";
  var sessionAttributes = {};
  var shouldEndSession = false;
  var speechOutput = "";

  if (selectedRegionSlot) {
    var selectedRegion = selectedRegionSlot.value;
    sessionAttributes = createRegionAttributes(selectedRegion);
    speechOutput = "You set the region to " + selectedRegion + ". You can now find out " +
      "how many instances are running in this region by saying, how many instances are running?";
    repromptText = "You can find out how many instances are running this region by saying, how many instances are running?";
  } else {
    speechOutput = "I'm not sure what region you selected. Please try again.";
    repromptText = "I'm not sure what region you selected. You can set the selected region by saying, " +
      "Set the region to Virginia.";
  }

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function createRegionAttributes(selectedRegion) {
  return {
    region: selectedRegion
  };
}

function getRegionIdentifier(selectedRegion){
  var regionIdentifier = "us-east-1";
  if (selectedRegion === "Oregon") {
    regionIdentifier = "us-west-2";
  } else if (selectedRegion === "Virginia") {
    regionIdentifier = "us-east-1";
  } else if (selectedRegion === "California") {
    regionIdentifier = "us-west-1";
  } else if (selectedRegion === "Seoul") {
    regionIdentifier = "ap-northeast-2";
  } else if (selectedRegion === "Tokyo") {
    regionIdentifier = "ap-northeast-1";
  } else if (selectedRegion === "Singapore") {
    regionIdentifier = "ap-southeast-1";
  }

  return regionIdentifier;
}

function getInstanceCount(intent, session, callback) {
  var selectedRegion;
  var repromptText = null;
  var sessionAttributes = {};
  var shouldEndSession = false;
  var speechOutput = "";

  if (session.attributes) {
    selectedRegion = session.attributes.region;
  }

  if (selectedRegion) {
    var regionIdentifier = getRegionIdentifier(selectedRegion);

    var ec2 = new aws.EC2({
      region: regionIdentifier
    });

    console.log('Using ' + selectedRegion + ' (' + regionIdentifier + ') for this intent.');
    var params = {
      Filters: [{
        Name: "instance-state-name",
        Values: ["running"]
      }]
    };

    ec2.describeInstanceStatus(params, function(err, data) {
      if (err) {
        console.log(err);
      }

      var instanceCount = 0;

      console.log(data);
      instanceCount = (data.InstanceStatuses && data.InstanceStatuses.length > 0) ? data.InstanceStatuses.length : 0;

      if (instanceCount == 1) {
        speechOutput = "There is currently " + instanceCount + " instance running.";
      } else if (instanceCount > 1) {
        speechOutput = "There are currently " + instanceCount + " instances running.";
      } else {
        speechOutput = "There are currently no instances running.";
      }

      shouldEndSession = false;

      callback(sessionAttributes,
        buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
    });
  } else {
    speechOutput = "I'm not sure what region you would like to use. Please select a region first by saying, " +
      "Set the region to Virginia.";

    callback(sessionAttributes,
      buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
  }
}

function getRegionFromSession(intent, session, callback) {
  var selectedRegion;
  var repromptText = null;
  var sessionAttributes = {};
  var shouldEndSession = false;
  var speechOutput = "";

  if (session.attributes) {
    selectedRegion = session.attributes.region;
  }

  if (selectedRegion) {
    speechOutput = "Your region is currently set to " + selectedRegion + ".";
    shouldEndSession = true;
  } else {
    speechOutput = "I'm not sure what region you would like to select. You can select a region by saying, " +
      "Set the region to Virginia.";
  }

  // Setting repromptText to null signifies that we do not want to reprompt the user.
  // If the user does not respond or says something that is not understood, the session
  // will end.
  callback(sessionAttributes,
    buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
}

function terminateUntaggedInstances(intent, session, callback) {
  var selectedRegion;
  var repromptText = null;
  var sessionAttributes = {};
  var shouldEndSession = false;
  var speechOutput = "";

  if (session.attributes) {
    console.log(session.attributes);
    selectedRegion = session.attributes.region;
  }

  if (selectedRegion){
    var regionIdentifier = getRegionIdentifier(selectedRegion);

    var ec2 = new aws.EC2({
      region: regionIdentifier
    });

    var params = {
      Filters: [{
        Name: "instance-state-name",
        Values: ["running"]
      }]
    };

    ec2.describeInstances(params, function(err, data) {
      if (err) {
        console.log(err);

        speechOutput = "Something went wrong while trying to find untagged instances. Please try again.";

        callback(sessionAttributes,
          buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));

        return;
      }

      var ids = [];

      for (var i = 0; i < data.Reservations.length; i++) {
        var Instances = data.Reservations[i].Instances;
        for (var j = 0; j < Instances.length; j++) {
          var instance = Instances[j];
          if (isTagless(instance)) ids.push(instance.InstanceId);
        }
      }

      if (ids.length === 0) {
        speechOutput = "I could not find any untagged instances.";

        callback(sessionAttributes,
          buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));

        return;
      }

      console.log("To Terminate (IDs): " + ids);

      var terminateParams = {
        InstanceIds: ids
      };

      ec2.terminateInstances(terminateParams, function(err,data){
          if (err){
            console.log(err);

            speechOutput = "Something went wrong while trying to terminate the untagged instances. Please try again.";

            callback(sessionAttributes,
              buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));

            return;
          }

          speechOutput = ids.length + " untagged instances were found and terminated.";

          callback(sessionAttributes,
            buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
      });
    });
  } else {
    speechOutput = "I'm not sure what region you would like to use. Please select a region first by saying, " +
      "Set the region to Virginia.";

    callback(sessionAttributes,
      buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
  }
}

function isTagless(instance) {
    try {
        if (!instance.Tags || instance.Tags.length === 0) {
            return true;
        }
        if (instance.Tags.length == 1) if (instance.Tags[0].Key == "Name" && instance.Tags[0].Value === "") return true;
    } catch (e) {}
    return false;
}

  // --------------- Helpers that build all of the responses -----------------------

  function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
      outputSpeech: {
        type: "PlainText",
        text: output
      },
      card: {
        type: "Simple",
        title: "SessionSpeechlet - " + title,
        content: "SessionSpeechlet - " + output
      },
      reprompt: {
        outputSpeech: {
          type: "PlainText",
          text: repromptText
        }
      },
      shouldEndSession: shouldEndSession
    };
  }

  function buildResponse(sessionAttributes, speechletResponse) {
    return {
      version: "1.0",
      sessionAttributes: sessionAttributes,
      response: speechletResponse
    };
}
