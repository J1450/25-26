$(document).ready(function () {
  $('#startCode').on('click', function() {
    window.location.href = '/start_code'
  });

  $('button[id^="changeled_"]').on('click', function() {
    var led = $(this).attr('id').split('_')[1];
    $.ajax({
        type: 'POST',
        url: '/change_led',
        data: { led : led },
        success: function(response) {
            console.log(response);
        }
    });
  });

  $('#recordInteraction').on('click', function() {
    var timestamp = new Date().toLocaleString(); // Get current timestamp
    var text = $('#task' + '1').text();
    $.ajax({
        type: 'POST',
        url: '/record_interaction', // Your Flask endpoint to handle recording
        data: { text : text, timestamp: timestamp },
        success: function(response) {
            console.log('Interaction recorded successfully!');
        },
        error: function(error) {
            console.error('Error recording interaction:', error);
        }
    });
  });

  $('#printPDF').on('click', function() {
    $.ajax({
        type: 'GET',
        url: '/generate_pdf', // Your Flask endpoint to handle recording
        success: function(response) {
            console.log('Interaction recorded successfully!');
        },
        error: function(error) {
            console.error('Error recording interaction:', error);
        }
    });
  });

  $('button[id^="update_"]').on('click', function() {
    var person = $(this).attr('id').split('_')[1]; // Extract person name from button ID
    $.ajax({
        type: 'POST',
        url: '/update_status',
        data: { person: person, status: 'complete' },
        success: function(response) {
            console.log('Status updated successfully for ' + person + '!');
            var updatedStatus = response.updatedStatus;
            var text = $('#task' + person.slice(-1)).text();
            $('#status' + person.slice(-1)).text('Status: ' + updatedStatus);
            $('#task' + person.slice(-1)).text('Task Completed');
            var timestamp = new Date().toLocaleString(); // Get current timestamp
            $.ajax({
              type: 'POST',
              url: '/record_interaction', // Your Flask endpoint to handle recording
              data: { text : text, timestamp: timestamp },
              success: function(response) {
                  console.log('Interaction recorded successfully!');
              },
              error: function(error) {
                  console.error('Error recording interaction:', error);
              }
            });
            
            var newStep = response.newStep;
            var newStatus = response.newStatus;
            var timerInSeconds = response.newTime;
            $('#status' + person.slice(-1)).text('Status: ' + newStatus);
            $('#task' + person.slice(-1)).text(newStep);

            var timerId; // declare timerId outside of the stopwatch function
            var startTimeStamp; // declare startTimeStamp outside of the stopwatch function

            function stopwatch(duration) {
              startTimeStamp = new Date().getTime();
              var oldTask = $('#task' + person.slice(-1)).text();

              function updateTimer() {
                if (oldTask != $('#task' + person.slice(-1)).text()) {
                  clearInterval(timerId);
                }

                var currentTimeStamp = new Date().getTime();
                var elapsedSeconds = Math.floor((currentTimeStamp - startTimeStamp) / 1000);
                var remainingSeconds = Math.max(duration - elapsedSeconds, 0);
                
                var elem = document.getElementById('stopwatchTimer');
                elem.innerHTML = remainingSeconds;

                if (remainingSeconds === 0) {
                  clearInterval(timerId);
                  elem.innerHTML = "Please Complete Activity";
                }
              }

              clearInterval(timerId); // Clear any existing intervals
              updateTimer(); // Call it once to initialize display
              timerId = setInterval(updateTimer, 50);
            }
            
            stopwatch(timerInSeconds);
        },
        error: function(error) {
            console.error('Error updating status for ' + person + '!', error);
        }
    });
  });


  var elem2 = document.getElementById('runningTimer');
  var timeElapsedId = setInterval(runningTimer, 50);
  var startTimeStamp = new Date().getTime();

  function runningTimer() {
    var currentTimeStamp = new Date().getTime();
    var timeElapsed = Math.floor((currentTimeStamp - startTimeStamp)/1000);
    var secondsElapsed = Math.floor(timeElapsed % 60);
    var minutesElapsed = Math.floor(timeElapsed/60)%60;
    var hoursElapsed = Math.floor(timeElapsed/60)%24;

    function convertToString (n){
      return n > 9 ? "" + n: "0" + n;
    }
    
    var secondsElapsed = convertToString(secondsElapsed);
    var minutesElapsed = convertToString(minutesElapsed);
    var hoursElapsed = convertToString(hoursElapsed);

    var newString = hoursElapsed + ":" + minutesElapsed + ":"+ secondsElapsed


    elem2.innerHTML = newString;
  }

  

  runningTimer(timerInSeconds);

  /*
  $.ajax({
    type: 'POST',
    url: '/change_led',
    data: JSON.stringify({}),
    contentType: 'application/json;charset=UTF-8',
    success: function(response) {
        console.log(response);
    }
  });
  */

  var socket = io.connect();

  //receive details from server
  socket.on("updateSensorData", function (msg) {
    console.log("Received sensorData :: " + msg.date + " :: " + msg.value);

    // Show only MAX_DATA_COUNT data
    if (myChart.data.labels.length > MAX_DATA_COUNT) {
      removeFirstData();
    }
    addData(msg.date, msg.value);
  });

});
