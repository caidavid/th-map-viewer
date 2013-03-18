(function() {
	var tribe_colors = []
	function get_tribe_color(tribe_id) {
		if (!tribe_colors[tribe_id]) {
			tribe_colors[tribe_id] = "#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) ; 
		}
		return tribe_colors[tribe_id];
	}

	var scale = 0.1;
	var content;
	function init_map(data) {
		var svg = d3.select("svg");
		content = svg.append("g")
			.attr("x", 0)
			.attr("y", 0)
			.attr("transform", "scale("+scale+")");
		
		// DATA JOIN
		// Join new data with old elements, if any.
		var cities = content.selectAll(".city")
		.data(data.Cities);

		// UPDATE
		// Update old elements as needed.
		cities.attr("class", "city");

		// ENTER
		// Create new elements as needed.
		
		cities.enter().append("use")
			.attr("xlink:href", "#sym-city")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/50) + ")"; })
			//.attr("x", function(d, i) { return d.x * 4 * scale; })
			//.attr("y", function(d, i) { return d.y * 1 * scale; })
			//.attr("transform", function(d, i) { return "translate(" + (d.x*4*scale) + "," + (d.y*1*scale) + ")"; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })

		// ENTER + UPDATE
		// Appending to the enter selection expands the update selection to include
		// entering elements; so, operations on the update selection after appending to
		// the enter selection will apply to both entering and updating nodes.
		//cities.text(function(d) { return d; });

		// EXIT
		// Remove old elements as needed.
		cities.exit().remove();

		console.log("done")
	}

	d3.json("map.json", function(error, data) {
		if(error) {
			alert("Failed to load the map data file, reload the page to try again");
		}
		else {
			init_map(data);
		}
	});
})();