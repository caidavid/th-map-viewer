(function() {
	var tribe_colors = []
	function get_tribe_color(tribe_id) {
		if (!tribe_colors[tribe_id]) {
			tribe_colors[tribe_id] = "#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) ; 
		}
		return tribe_colors[tribe_id];
	}

	function update_map(data) {
		// DATA JOIN
	var svg = d3.select("svg");
		// Join new data with old elements, if any.
		var cities = svg.selectAll(".city")
		.data(data.Cities);

		// UPDATE
		// Update old elements as needed.
		cities.attr("class", "city");

		var scale = 0.08;
		// ENTER
		// Create new elements as needed.
		cities.enter().append("circle")
		//.attr("class", "city")
		.attr("cx", function(d, i) { return d.x * 4 * scale; })
		.attr("cy", function(d, i) { return d.y * 1 * scale; })
		.attr("r", function(d, i) { return d.value/50; })
		.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })

		// ENTER + UPDATE
		// Appending to the enter selection expands the update selection to include
		// entering elements; so, operations on the update selection after appending to
		// the enter selection will apply to both entering and updating nodes.
		cities.text(function(d) { return d; });

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
			update_map(data);
		}
	});
})();