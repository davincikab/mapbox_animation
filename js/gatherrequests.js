
//link to pull "pending" requests or requests with shipdate = this week
const pendingRequests = 'imgs/rawdata.json'; //Use rawdata.json

let allPendingRequestsArray = [];
let geocodeArray = {};
var promises = [];
var i;
var z;
var routeVAR = {};
var pointVAR = {};

promises.push(
    fetch('imgs/zipcode.json') //Use zipcodes.json
        .then(response2 => {
            return response2.json()
        })
        .then(data2 => {
            geocodeArray = JSON.parse(JSON.stringify(data2));  
        })
);


promises.push(
    fetch(pendingRequests)
        .then(response => {
            return response.json()
        })
        .then(data => {
            data.forEach(element => {
                //for each "pending" sample requeust, looks at shipping address and parses out the last 5 digit number
                let destinationZipCode = element.Ship_Address.match(/[0-9]{5}/g);

                //need to use the DestinationZipCode array to find the "last" 5 digit number, need else for if its null
                if (destinationZipCode != null) {
                    element.DestinationZipCode = destinationZipCode[destinationZipCode.length - 1];
                    allPendingRequestsArray.push(element); //adds the entire element to another array for use elsewhere in the project
                    //ONLY adds non null values so it doesnt interfere with MAP interation later. 
                } else {
                    element.DestinationZipCode = destinationZipCode;
                    element.destinationLatitude = "";
                    element.destinationLongitude = "";
                }
            });
            //console.log(allPendingRequestsArray);
        })
);

Promise.all(promises).then(() => {
    console.log('ALL PROMISES - SHOULD BE LAST');
    //console.log(geocodeArray[0].zip + "  " + geocodeArray[0].lat + "  " + geocodeArray[0].lng + "  ");
    //console.log(geocodeArray.length);

    allPendingRequestsArray.forEach(el => {

        //making sure the request has a Destination Zip Code 
        if (el.DestinationZipCode != null) {
            if (el.DestinationZipCode.substr(0, 2) == "00") {//if zipcode has 2 leading 0
                for (i = 0; i < geocodeArray.length; i++) {
                    if (el.DestinationZipCode.substr(2) == geocodeArray[i].zip) {
                        el.destinationLatitude = geocodeArray[i].lat;
                        el.destinationLongitude = geocodeArray[i].lng;
                        //console.log(el);
                        break;
                    }
                }
            } else if (el.DestinationZipCode.substr(0, 1) == "0") {//if zipcode has 1 leading 0
                for (i = 0; i < geocodeArray.length; i++) {
                    if (el.DestinationZipCode.substr(1) == geocodeArray[i].zip) {
                        el.destinationLatitude = geocodeArray[i].lat;
                        el.destinationLongitude = geocodeArray[i].lng;
                        //console.log(el);
                        break;
                    }
                }
            } else {//all other zipcodes
                for (i = 0; i < geocodeArray.length; i++) {
                    if (el.DestinationZipCode == geocodeArray[i].zip) {
                        el.destinationLatitude = geocodeArray[i].lat;
                        el.destinationLongitude = geocodeArray[i].lng;
                        //console.log(el);
                        break;
                    }
                }
            }
        }
    })

})
    .then(() => {
        console.log(allPendingRequestsArray);

        mapboxgl.accessToken = 'pk.eyJ1IjoibXNjaXBpb25lIiwiYSI6ImNrOTV1Zmp2ZDA2cnMzZXFmenZzZmYzcWcifQ.Vb8ThSGuwACB6IGAsfiuGw';
        var map = new mapboxgl.Map({
            container: 'map',
            //style: 'mapbox://styles/mapbox/streets-v11',
            style: 'mapbox://styles/mapbox/dark-v10',
            center: [-96, 37.8],
            zoom: 3
        });


        // RVA
        var originRVA = [-77.46101, 37.505147];
        var markerRVA = [-77.46101, 38.25]; //offset Richmond a bit so the marker point appears at the correct point
        var destination1 = [allPendingRequestsArray[0].destinationLongitude, allPendingRequestsArray[0].destinationLatitude];

        // A simple line from origin to destination.
        routeVAR = {
            'type': 'FeatureCollection',
            'features': [
                /*    
                    {
                        'type': 'Feature',
                        'geometry': {
                                'type': 'LineString',
                                'coordinates': [originRVA, destination1]
                            }
                    }
                */
            ]
        };

        pointVAR = {
            'type': 'FeatureCollection',
            'features': [
                /*
                {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'Point',
                        'coordinates': originRVA
                    }
                }
                */
            ]
        };

        markerVAR = {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'Point',
                        'coordinates': originRVA
                    }
                }
            ]
        };


        //loops through all pending requests and adds them to pointVAR and routeVAR
        for (i = 0; i < allPendingRequestsArray.length; i++) { 
            var destinationVAR = [allPendingRequestsArray[i].destinationLongitude, allPendingRequestsArray[i].destinationLatitude];
            routeVAR.features[i] = { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [originRVA, destinationVAR] } };
            pointVAR.features[i] = { 'type': 'Feature', 'properties': {}, 'geometry': { 'type': 'Point', 'coordinates': originRVA } }
            //console.log(routeVAR.features.length);
            //console.log(pointVAR);
        }



        for (i = 0; i < routeVAR.features.length; i++) {
            var lineDistance = turf.lineDistance(routeVAR.features[i], 'kilometers');
            var arc = [];
            var steps = 500;

            // Draw an arc between the `origin` & `destination` of the two points
            for (var y = 0; y < lineDistance; y += lineDistance / steps) {
                var segment = turf.along(routeVAR.features[i], y, 'kilometers');
                arc.push(segment.geometry.coordinates);
            }

            // Update the route with calculated arc coordinates
            routeVAR.features[i].geometry.coordinates = arc;

        }

console.log(pointVAR);
console.log(routeVAR);

        // Used to increment the value of the point measurement against the route.
        var counter = 0;
        var done = false;
        var animatePath;

        map.on('load', function () {
            // Add a source and layer displaying a point which will be animated in a circle.
            map.loadImage(
                'https://placekitten.com/200/300', function (err, image) {
                    map.addImage('cat', image)
                }
            )

            map.loadImage(
                '/imgs/box_icon_yellow.png', function(err, image){         //for development testing
                    map.addImage('provingGround', image)
                }
            )

            map.loadImage(
                '/imgs/box_icon_yellow.png', function(err, image){         //for development testing
                    map.addImage('boxIcon', image)
                }
            )

            map.addSource('route', {
                'type': 'geojson',
                'data': routeVAR
            });

            map.addSource('point', {
                'type': 'geojson',
                'data': pointVAR
            });

            map.addSource('originMarker', {
                'type': 'geojson',
                'data': markerVAR
            });

            map.addLayer({
                'id': 'route',
                'source': 'route',
                'type': 'line',
                'paint': {
                    'line-width': 1,
                    //'line-color': '#32CD32' //original green
                    'line-color': '#D9594C' //Proving Ground Red
                }
            });

            map.addLayer({
                'id': 'point',
                'source': 'point',
                'type': 'symbol',
                'layout': {
                    'icon-image': 'airport-15',
                    //'icon-image': 'cat',
                    // 'icon-image': 'boxIcon',
                    'icon-size': 0.9,
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            });

            map.addLayer({
                'id': 'originMarkerLayer',
                'source': 'originMarker',
                'type': 'symbol',
                'layout': {
                    // 'icon-image': 'provingGround',
                    'icon-size': 0.125,
                    //'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            });

            function animate(featureIdx, cntr) {
                // Update point geometry to a new position based on counter denoting
                // the index to access the arc.
                if (cntr >= routeVAR.features[featureIdx].geometry.coordinates.length - 1) { 
                    return;
                }

                pointVAR.features[featureIdx].geometry.coordinates = routeVAR.features[featureIdx].geometry.coordinates[cntr];

                pointVAR.features[featureIdx].properties.bearing = turf.bearing(
                    turf.point(routeVAR.features[featureIdx].geometry.coordinates[cntr >= steps ? cntr - 1 : cntr]),
                    turf.point(routeVAR.features[featureIdx].geometry.coordinates[cntr >= steps ? cntr : cntr + 1])
                );


                // Update the source with this new data.
                map.getSource('point').setData(pointVAR);

                // Request the next frame of animation so long the end has not been reached.
                if (cntr < (steps - 1)) { //I had to add -1 because routeVAR had some lines with 500 points and others with 501
                    // console.log( cntr + ' of ' + steps);
                    cntr = cntr + 1;
                    animatePath = requestAnimationFrame(function() {
                        animate(featureIdx, cntr)
                    });
                    
                } else {
                  //  animateLoop(); //restarts animation once the previous animation gets all the way to the number of steps in the Route
                //   setTimeout(function(e){
                //     console.log(done);
                //         // requestAnimationFrame(animateLoop);
                //         animateLoop();
                //     }, 250);

                    // requestAnimationFrame(animateLoop);
                    console.timeEnd("Animate");
                    done = !done;
                    cancelAnimationFrame(animatePath);
                }
               

            }


            /* //NO LONGER NEEDED SINCE REPLAY BUTTON WAS REMOVED
                document.getElementById('replay').addEventListener('click', function() {
                    // Set the coordinates of the original point back to origin
                    pointVAR.features[0].geometry.coordinates = originRVA;
                     
                    // Update the source layer
                    map.getSource('point').setData(pointVAR);
                     
                    // Reset the counter
                    counter = 0;
                     
                    // Restart the animation.
                    animate(counter);
                });
            */

            //animate once on page load
            // for (var num = 0; num < pointVAR.features.length; num++) {
            //     animate(num, 0);
            // }
            var routeCount = pointVAR.features.length;
            function animateLoop() {
                // Start the animation.
                for (var num = 0; num < routeCount; num++) {
                    animate(num, 0);

                    // if(num == routeCount-1) {
                       
                    //     setTimeout(function(e){
                    //         console.log("Done");
                    //         num = 0;
                    //         requestAnimationFrame(animateLoop);
                            
                            
                    //         // animateLoop();
                    //     }, 25250);
                    // }
                }

                console.log(num);
                // requestAnimationFrame(animateLoop);

            }

            console.time("Animate");
            animateLoop();
            // requestAnimationFrame(animateLoop);

            setInterval(function(e){
                if(done) {
                    console.time("Animate");
                    // requestAnimationFrame(animateLoop);
                    animateLoop();
                    done = !done;
                }
            }, 15250);

            //replays automatically every 10 seconds
            //setInterval(animateLoop, 9250);

            function getInterval () {
                
            }


        });

    });
