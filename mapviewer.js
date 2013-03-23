(function() {
	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
			? args[number]
			: match;
		});
	};

	var tribe_colors = [ "#fff" ]
	function get_tribe_color(tribe_id) {
		if (!tribe_colors[tribe_id]) {
			tribe_colors[tribe_id] = "#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) ; 
		}
		return tribe_colors[tribe_id];
	}

	var tiles_width = 3400;
	var tiles_height = 6200;
	var map_width = tiles_width * 4;
	var map_height = tiles_height;

	var map_data;
	var influence_image;
	var cur_trans = [ 0, 0 ];
	var cur_scale;
	var prev_scale;
	var filters = {};

	var canvas;
	var canvas_ctx;
	var content;
	var info_text, cursor_text;

	var canvas_width;
	var canvas_height;
	var xmin, xmax;
	var ymin, ymax;

	function on_zoom(force_transition) {
		var trans = zoom.translate().slice()
		var scale = zoom.scale();

		// console.log(".", cur_scale, cur_trans, "=>", scale, trans)

		if (force_transition || scale != prev_scale) {
			var t1 = cur_trans.slice();
			var t2 = trans.slice();
			var s1 = cur_scale;
			var s2 = scale;

			console.log("transition:", s1, "=>", s2, t1,"=>", t2);

			d3.transition()
			.duration(500)
				//.ease("quad-in-out")
				.tween("zoom", function() {
					itrans = d3.interpolate(t1, t2);
					iscale = d3.interpolate(s1, s2);
					return function(t) {
						var trans = itrans(t);
						var scale = iscale(t);
						set_zoom(trans, scale);
						draw();
					}
				})

			} else {
			d3.transition().duration(0)//.each("stop", function() { console.log("stop");}); // abort transition
			set_zoom(trans, scale);
			draw();
		}

		prev_scale = scale;
	}

	function set_zoom(trans, scale) {
		canvas_ctx.restore();
		canvas_ctx.save();
		canvas_ctx.translate(trans[0] + 0.5, trans[1] + 0.5);
		canvas_ctx.scale(scale, scale);

		// zoom.translate(trans);
		// zoom.scale(scale);

		cur_trans = trans;
		cur_scale = scale;

		var margin_x = 100, margin_y = 100;

		xmin = (-trans[0] - margin_x) / scale; xmax = (-trans[0] + canvas_width + margin_x) / scale;
		ymin = (-trans[1] - margin_y) / scale; ymax = (-trans[1] + canvas_height + margin_y) / scale;
	}

	function is_inside_viewport(x, y) {
		return x > xmin && x < xmax && y > ymin && y < ymax;
	}

	function update_cursor() {
		var pos = d3.mouse(this);
		var x = (pos[0] + -cur_trans[0]) / cur_scale / 4;
		var y = (pos[1] + -cur_trans[1]) / cur_scale;
		var text = Math.max(0, Math.min(tiles_width, Math.floor(x))) + " " + Math.max(0, Math.min(tiles_height, Math.floor(y)));
		// var text = x + " " + y;
		cursor_text.text(text + " " + Math.round(cur_scale * 100) + "%");
	}

	function get_city(group_id) {
		return _(map_data.Cities).find(function(d) { return d.groupId == group_id });
	}

	function get_player(player_id) {
		return _(map_data.Players).find(function(d) { return d.playerId == player_id });
	}

	function get_tribe(tribe_id) {
		return _(map_data.Tribes).find(function(d) { return d.tribeId == tribe_id });
	}

	function show_city_info(city) {
		var text = sformat("City: {1} / Level {2} / Player: {3}{4}", city.name, city.level, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
		info_text.text(text);
	}

	function show_troop_info(troop) {
		var city = get_city(troop.groupId)
		var text = sformat("Troop: {1} ({2}) / Player: {3}{4}", city.name, troop.troopId, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
		info_text.text(text);
	}

	function show_stronghold_info(sh) {
		var text = sformat("Stronghold: {1} / Level {2} / {3}", sh.name, sh.level, sh.tribeId != 0 && get_tribe(sh.tribeId).name || "Unoccupied");
		info_text.text(text);
	}

	function clear_info() {
		info_text.text("");
	}

	var search_input
	var search_results
	function do_search() {
		var q = search_input.property("value");
		var match_cities = [];
		var match_players = [];
		var match_tribes = [];
		var match_strongholds = [];
		
		if(q && q.length > 0) {
			q = q.toLowerCase();
			match_cities = map_data.Cities.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; }).sort();
			match_players = map_data.Players.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_tribes = map_data.Tribes.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_strongholds = map_data.Strongholds.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
		}

		function sort_function(x, y) { return x.name < y.name ? -1 : 1; }

		search_results_cities = search_results.selectAll(".city_search_result").data(match_cities);
		search_results_cities.exit().remove();
		search_results_cities.enter().append("div");
		search_results_cities
		.sort(sort_function)
		.attr("class", "city_search_result")
		.text(function(d) { return "City: " + d.name; })

		search_results_players = search_results.selectAll(".player_search_result").data(match_players);
		search_results_players.exit().remove();
		search_results_players.enter().append("div");
		search_results_players
		.sort(sort_function)
		.attr("class", "player_search_result")
		.text(function(d) { return "Player: " + d.name; });

		search_results_tribes = search_results.selectAll(".tribe_search_result").data(match_tribes);
		search_results_tribes.exit().remove();
		search_results_tribes.enter().append("div");
		search_results_tribes
		.sort(sort_function)
		.attr("class", "tribe_search_result")
		.text(function(d) { return "Tribe: " + d.name; });

		search_results_strongholds = search_results.selectAll(".stronghold_search_result").data(match_strongholds);
		search_results_strongholds.exit().remove();
		search_results_strongholds.enter().append("div");
		search_results_strongholds
		.sort(sort_function)
		.attr("class", "stronghold_search_result")
		.text(function(d) { return "Stronghold: " + d.name; });


		search_results
		.on("click", function() { 
			var obj = d3.select(d3.event.target).data()[0];
			if (obj.x || obj.y)
				center_map_tile(obj.x, obj.y, 1);
		})
	}

	function center_map_tile(x, y, scale) {
		scale = scale || zoom.scale();

		var canvas_width = parseInt(canvas.style("width"));
		var canvas_height = parseInt(canvas.style("height"));

		zoom.scale(scale);
		zoom.translate([(-x * 4) * scale + canvas_width / 2, (-y) * scale + canvas_height / 2])

		on_zoom(true);
	}

	function get_min_zoom_scale() {
		return Math.min(canvas_width / map_width, canvas_height / map_height)
	}

	function resize_canvas() {
		canvas.attr("width", content.style("width"));
		canvas.attr("height", content.style("height"));
		canvas_width = parseInt(canvas.style("width"));
		canvas_height = parseInt(canvas.style("height"));
	}

	function init_map(data) {
		map_data = data;

		d3.select("#snapshot_timestamp").text("Using data from " + new Date(map_data.SnapshotBegin));

		on_zoom();
	}

	function init() {
		content = d3.select("#content");
		canvas = d3.select("canvas");
		canvas_ctx = canvas.node().getContext("2d");
		canvas_ctx.save();

		resize_canvas();

		cur_scale = get_min_zoom_scale();

		zoom = d3.behavior.zoom()
		.translate(cur_trans)
		.scale(cur_scale)
		.scaleExtent([get_min_zoom_scale(), 1])
		.on("zoom", on_zoom);
		
		canvas.call(zoom);

		d3.select(window).on("resize", function() {
			resize_canvas();

			var min_scale = get_min_zoom_scale() 
			if(zoom.scale() < min_scale || zoom.scale() == zoom.scaleExtent()[0]) {
				zoom.scale(min_scale);
				on_zoom();
			}
			zoom.scaleExtent([min_scale, 1])

			on_zoom();
		})

		// search
		search_input = d3.select("#search");
		search_input.on("input", do_search);

		search_results = d3.select("#search_results");

		// filters
		function update_visibility(selector, checkbox) {
			filters[selector] = checkbox.checked;
			draw();
		}

		d3.select("#filter_cities").on("change", function() { update_visibility("city", d3.event.target); })
		d3.select("#filter_forests").on("change", function() { update_visibility("forest", d3.event.target); })
		d3.select("#filter_strongholds").on("change", function() { update_visibility("stronghold", d3.event.target); })
		d3.select("#filter_troops").on("change", function() { update_visibility("troop", d3.event.target); })
		d3.select("#filter_barbarians").on("change", function() { update_visibility("barbarian", d3.event.target); })
		d3.select("#filter_influence").on("change", function() { update_visibility("influence", d3.event.target); })
		
		update_visibility("city", d3.select("#filter_cities").node());
		update_visibility("forest", d3.select("#filter_forests").node());
		update_visibility("stronghold", d3.select("#filter_strongholds").node());
		update_visibility("troop", d3.select("#filter_troops").node());
		update_visibility("barbarian", d3.select("#filter_barbarians").node());
		update_visibility("influence", d3.select("#filter_influence").node());

		// events
		cursor_text = d3.select("#cursor_text");
		info_text = d3.select("#info_text");
		canvas.on("mousemove", update_cursor);

		// load resources
		d3.json("map.json", function(error, data) {
			if(error) {
				alert("Failed to load the map data file, reload the page to try again");
			}
			else {
				init_map(data);
			}
		});

		influence_image = new Image();
		influence_image.onload = function() { draw(); };
		influence_image.src = "influence_bitmap_small.png";
	}

	var min_small_text_scale = 0.5;
	var min_normal_text_scale = 0.3;
	var font_big = "bold 10pt Arial";
	var font_normal = "10pt Arial";
	var font_small = "8pt Arial";


	function drawTextOutline(text, x, y, w, outline, fill) {
		canvas_ctx.fillStyle = outline;
		for (xi = -w; xi <= w; ++xi) {
			for (yi = -w; yi <= w; ++yi) {
				if (!(xi == 0 && yi == 0)) {
					canvas_ctx.fillText(text, x + xi, y + yi);
				}
			}
		}

		canvas_ctx.fillStyle = fill;
		canvas_ctx.fillText(text, x, y);
	}

	function draw_text() {
		// cities
		if (filters.city) {
			for (var i = 0; i < map_data.Cities.length; ++i) {
				var city = map_data.Cities[i];
				var x = city.x * 4;
				var y = city.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.font = font_normal;
					canvas_ctx.fillStyle = "black";
					canvas_ctx.textAlign = "center";
					canvas_ctx.fillText(city.name, x, y + 20);
				}
			}
		}

		// strongholds
		if (filters.stronghold) {
			for (var i = 0; i < map_data.Strongholds.length; ++i) {
				var sh = map_data.Strongholds[i];
				var x = sh.x * 4;
				var y = sh.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.font = font_big;
					canvas_ctx.fillStyle = "black";
					canvas_ctx.textAlign = "center";
					// canvas_ctx.fillText(sh.name, x, y + 20 + sh.level * 2);
					drawTextOutline(sh.name, x, y + 30 + sh.level * 5, 1, "black", "gold");
				}
			}
		}

		// forests
		if (filters.forest) {
			for (var i = 0; i < map_data.Forests.length; ++i) {
				var forest = map_data.Forests[i];
				var x = forest.x * 4;
				var y = forest.y;

				if (is_inside_viewport(x, y)) {
					if (cur_scale > min_small_text_scale) {
						canvas_ctx.font = font_small;
						canvas_ctx.fillStyle = "black";
						canvas_ctx.textAlign = "start";
						canvas_ctx.fillText(forest.level, x + 4, y + 12);
					}
				}
			}
		}

		// barbarians
		if (filters.barbarian) {
			for (var i = 0; i < map_data.Barbarians.length; ++i) {
				var barb = map_data.Barbarians[i];
				var x = barb.x * 4;
				var y = barb.y;

				if (is_inside_viewport(x, y)) {
					if (cur_scale > min_small_text_scale) {
						canvas_ctx.font = font_small;
						canvas_ctx.fillStyle = "black";
						canvas_ctx.textAlign = "start";
						canvas_ctx.fillText(barb.level, x + 4, y + 12);
					}
				}
			}
		}
	}

	var draw_text_timeout;

	function draw() {
		if (!map_data) {
			return;
		}

		canvas_ctx.clearRect(-cur_trans[0] / cur_scale, -cur_trans[1] / cur_scale, canvas_width / cur_scale, canvas_height / cur_scale);

		var start_time = window.performance.now();

		// influence image
		if (filters.influence) {
			canvas_ctx.drawImage(influence_image, 0, 0, map_width, map_height);
		}

		// forests
		if (filters.forest) {
			for (var i = 0; i < map_data.Forests.length; ++i) {
				var forest = map_data.Forests[i];
				var x = forest.x * 4;
				var y = forest.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.strokeStyle = "black";
					canvas_ctx.fillStyle = "green";
					canvas_ctx.fill();
					canvas_ctx.stroke();
				}
			}
		}

		// barbarians
		if (filters.barbarian) {
			for (var i = 0; i < map_data.Barbarians.length; ++i) {
				var barb = map_data.Barbarians[i];
				var x = barb.x * 4;
				var y = barb.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.strokeStyle = "black";
					canvas_ctx.fillStyle = "blue";
					canvas_ctx.fill();
					canvas_ctx.stroke();
				}
			}
		}

		// troops
		if (filters.troop) {
			for (var i = 0; i < map_data.Troops.length; ++i) {
				var troop = map_data.Troops[i];
				var x = troop.x * 4;
				var y = troop.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.strokeStyle = "black";
					canvas_ctx.fillStyle = get_tribe_color(troop.tribeId);;
					canvas_ctx.fill();
					canvas_ctx.stroke();
				}
			}
		}

		// cities
		if (filters.city) {
			for (var i = 0; i < map_data.Cities.length; ++i) {
				var city = map_data.Cities[i];
				var x = city.x * 4;
				var y = city.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.beginPath();
					canvas_ctx.moveTo(x + -7, y + 0);
					canvas_ctx.lineTo(x + 0, y + -4);
					canvas_ctx.lineTo(x + 7, y + 0);
					canvas_ctx.lineTo(x + 0, y + 4);
					canvas_ctx.closePath();

					canvas_ctx.strokeStyle = "black";
					canvas_ctx.fillStyle = get_tribe_color(city.tribeId);
					canvas_ctx.fill();
					canvas_ctx.stroke();
				}
			}
		}

		// strongholds
		if (filters.stronghold) {
			for (var i = 0; i < map_data.Strongholds.length; ++i) {
				var sh = map_data.Strongholds[i];
				var x = sh.x * 4;
				var y = sh.y;

				if (is_inside_viewport(x, y)) {
					// inner dot
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 5, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.fillStyle = get_tribe_color(sh.tribeId);
					canvas_ctx.fill();

					canvas_ctx.lineWidth = 1;
					canvas_ctx.strokeStyle = "black";
					canvas_ctx.stroke();

					// colored circle
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 10 + sh.level * 5, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					// canvas_ctx.strokeStyle = "black";
					// canvas_ctx.fillStyle = get_tribe_color(sh.tribeId);
					// canvas_ctx.fill();

					canvas_ctx.strokeStyle = get_tribe_color(sh.tribeId);
					canvas_ctx.lineWidth = 8;
					canvas_ctx.stroke();

					canvas_ctx.strokeStyle = "black";
					canvas_ctx.lineWidth = 1;

					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 10 + sh.level * 5 + 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();
					canvas_ctx.stroke();

					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 10 + sh.level * 5 - 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();
					canvas_ctx.stroke();
				}
			}
		}

		var frame_time = window.performance.now() - start_time;
		// console.log(frame_time + "ms (" + (1000.0/frame_time) + " fps)");

		if (cur_scale > min_normal_text_scale) {
			draw_text();
		}
		else {
			clearTimeout(draw_text_timeout)
			draw_text_timeout = setTimeout(draw_text, 100);
		}

		/*
		if(frame_time > 50) {
	 		if(scale > min_small_text_scale) {
				min_small_text_scale += 0.1;
				console.log("min_small_text_scale", min_small_text_scale);
			} else
			{
				min_small_text_scale += 0.1;
				min_normal_text_scale += 0.1;
				console.log("min_normal_text_scale", min_normal_text_scale);
				console.log("min_small_text_scale", min_small_text_scale);
			}
		}
		*/

		/*			
		// events
		function common_events(c) {
			c.on("click", function(d) { center_map_tile(d.x, d.y); })
				.on("dblclick", function(d) { center_map_tile(d.x, d.y, 1); })
				.on("mouseout", function(d) { clear_info() })		
		}

		cities.on("mouseover", function(d) { show_city_info(d); })
		strongholds.on("mouseover", function(d) { show_stronghold_info(d); })
		troops.on("mouseover", function(d) { show_troop_info(d); })

		common_events(cities);
		common_events(strongholds);
		common_events(troops);
		common_events(forests);
		common_events(barbarians);
		*/

	}

	d3.select(window).on("load", init);
})();