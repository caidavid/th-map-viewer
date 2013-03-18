(function() {
	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
				? args[number]
				: match;
			});
	};

	var tribe_colors = []
	function get_tribe_color(tribe_id) {
		if (!tribe_colors[tribe_id]) {
			tribe_colors[tribe_id] = "#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) ; 
		}
		return tribe_colors[tribe_id];
	}


	var cur_trans = [0, 0];
	var cur_scale = 0.1;
	var svg;
	var content;
	var map_data;
	function on_zoom() {
		var trans = d3.event.translate;
		var scale = d3.event.scale;
		var target = content;
		if (scale != cur_scale)
			target = content.transition();

		target.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");

		cur_scale = scale;
		cur_trans = trans;
	}

	function update_cursor() {
		var pos = d3.mouse(this);
		var x = pos[0] / 4;
		var y = pos[1];
		var text = x.toFixed() + " " + y.toFixed();
		cursor_text.text(text);
	}

	function get_player_name(player_id) {
		return map_data.Players.indexOf(function(d) { return d.playerId == player_id})
	}

	function format_city(city) {
		return sformat("{1} / {2} / {3} / {4}", city.name, city.level, get_player_name(city.playerId), "");
	}

	function init_map(data) {
		map_data = data;
		svg = d3.select("svg");
		
		var map_width = 13600;
		var map_height = 6200;
		var svg_width = parseInt(svg.style("width"));
		var svg_height = parseInt(svg.style("height"));

		var zoom = d3.behavior.zoom()
			.translate(cur_trans)
    		.scale(cur_scale)
    		.scaleExtent([Math.min(svg_width/map_width, svg_height/map_height), 1])
    		.on("zoom", on_zoom);

		zoom_container = svg.append("g")
			.call(zoom)

		// map content
		content = zoom_container.append("g")
			.attr("transform", "scale("+cur_scale+")")
			.on("mousemove", update_cursor);

		// background
		content.append("rect")
			.attr("width", map_width)
			.attr("height", map_height)
			.attr("fill", "white");

		// influence image
		content.append("image")
			.attr("width", map_width)
			.attr("height", map_height)
			.attr("xlink:href", "influence_bitmap_small.png");

		// cities
		var cities = content.selectAll(".city")
			.data(data.Cities);

		cities.enter().append("polygon")
			.attr("class", "city")
			.attr("points", "-7,0 0,-4 7,0 0,4")
			.attr("stroke", "black")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" /* + " scale(" + Math.min(2, Math.max(1, (d.value/70))) + ")"*/; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
			.on("mouseover", function(d) { info_text.text(format_city(d)); })
			.on("mouseout", function(d) { info_text.text("") })
/*
		cities.enter().append("use")
			.attr("xlink:href", "#sym-city")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/70) + ")"; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
*/
/*
		cities.enter().append("circle")
			// .attr("cx", function(d, i) { return d.x * 4; })
			// .attr("cy", function(d, i) { return d.y * 1; })
			.attr("r", 10)
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/70) + ")"; })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
*/
		// strongholds
		var stronholds = content.selectAll(".stronghold")
			.data(data.Stronholds);

		strongholds.enter().append("circle")
			.attr("class", "stronghold")
			.attr("r", 10)
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/70) + ")"; })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
		

		// forests

		// static stuff
		cursor_text = zoom_container.append("text")
			.attr("x", 10)
			.attr("y", 20)
			.attr("fill", "black")

		info_text = zoom_container.append("text")
			.attr("x", 10)
			.attr("y", 40)
			.attr("fill", "black")
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