(function() {
	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
			? args[number]
			: match;
		});
	};

	function get_random_color(list, id) {
		var c = list[id];
		if (c) {
			return c;
		}
		else {
			return list[id] = ("#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16));
		}
	}

	var tribe_colors = { 0: "#fff" }
	function get_tribe_color(tribe_id) {
		return get_random_color(tribe_colors, tribe_id);
	}

	var color_tribes = { }
	function get_tribe_by_color(r, g, b) {
		var col = "#" + ("000000" + (r << 16 | g << 8 | b).toString(16)).slice(-6);
		return color_tribes[col];
	}

	var player_colors = {}
	function get_player_color(player_id) {
		return get_random_color(player_colors, player_id);
	}

	var tiles_width = 3400;
	var tiles_height = 6200;
	var map_width = tiles_width * 4;
	var map_height = tiles_height;

	var map_data;
	var influence_image;
	var cur_trans = [ 0, 0 ];
	var cur_scale;
	var filters = {};

	var canvas;
	var canvas_ctx;
	var content;
	var info_text, cursor_text;

	var canvas_width;
	var canvas_height;
	var xmin, xmax;
	var ymin, ymax;

	function on_zoom() {
		var trans = zoom.translate().slice()
		var scale = zoom.scale();
		// console.log("on_zoom", cur_scale, cur_trans, "=>", scale, trans)

		if (scale != cur_scale) {
			transition_zoom(trans, scale, 250);
		}
		else {
			d3.transition().duration(0); // abort transition
			set_zoom(trans, scale);
			draw();
		}
	}

	function transition_zoom(trans, scale, duration) {
		var t1 = cur_trans.slice();
		var s1 = cur_scale;
		
		var t2 = trans.slice();
		var s2 = scale;
		// console.log("transition:", "s:", s1, "=>", s2, "tr:", t1,"=>", t2);

		d3.transition()
			.duration(duration)
			.ease("quad-out")
			.tween("zoom", function() {
				itrans = d3.interpolate(t1, t2);
				iscale = d3.interpolate(s1, s2);
				return function(t) {
					var trans = itrans(t);
					var scale = iscale(t);
					set_zoom(trans, scale);
					draw();
				}
			});
	}

	function set_zoom(trans, scale) {
		cur_trans = trans;
		cur_scale = scale;

		zoom.translate(trans);
		zoom.scale(scale);

		// set canvas transformation
		canvas_ctx.restore();
		canvas_ctx.save();
		canvas_ctx.translate(trans[0] + 0.5, trans[1] + 0.5);
		canvas_ctx.scale(scale, scale);

		// update viewport extents
		var margin_x = 100, margin_y = 100;
		xmin = (-trans[0] - margin_x) / scale; xmax = (-trans[0] + canvas_width + margin_x) / scale;
		ymin = (-trans[1] - margin_y) / scale; ymax = (-trans[1] + canvas_height + margin_y) / scale;
	}

	function is_inside_viewport(x, y) {
		return x > xmin && x < xmax && y > ymin && y < ymax;
	}

	var mouse_raw;
	var mouse_x = 0, mouse_y = 0;
	var last_frame_time = 0;
	function update_cursor_text() {
		var x = Math.max(0, Math.min(tiles_width, Math.floor(mouse_x / 4)));
		var y = Math.max(0, Math.min(tiles_height, Math.floor(mouse_y)));
		cursor_text.text(sformat("{1} {2} {3}% {4} ms", x, y, Math.round(cur_scale * 100), last_frame_time.toFixed(0)));
	}

	var frame_objects = {
		forests: [],
		troops: [],
		barbarians: [],
		cities: [],
		strongholds: []
	}

	function get_object_by_location(x, y) {
		function get_dist_sq(ox, oy) {
			var dx = ox - x, dy = oy - y;
			return dx * dx + dy * dy;
		}
		
		min_dist_sq = 10 * 10;

		for (var i = 0; i < frame_objects.troops.length; ++i) {
			var obj = frame_objects.troops[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "troop", obj ];
			}
		}

		for (var i = 0; i < frame_objects.barbarians.length; ++i) {
			var obj = frame_objects.barbarians[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "barbarian", obj ];
			}
		}

		for (var i = 0; i < frame_objects.cities.length; ++i) {
			var obj = frame_objects.cities[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "city", obj ];
			}
		}

		for (var i = 0; i < frame_objects.strongholds.length; ++i) {
			var obj = frame_objects.strongholds[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "stronghold", obj ];
			}
		}
	}

	var mouseover_timer;	
	function on_canvas_mousemove() {
		// update mouse coords
		var pos = d3.mouse(this);
		mouse_raw = pos
		mouse_x = (pos[0] - cur_trans[0]) / cur_scale;
		mouse_y = (pos[1] - cur_trans[1]) / cur_scale;
		update_cursor_text();

		clearTimeout(mouseover_timer);

		var obj = get_object_by_location(mouse_x, mouse_y);
		canvas.style("cursor", obj ? "pointer" : "auto")
		if (obj) {
			var text;
			switch (obj[0]) {
				case "troop":
					text = show_troop_info(obj[1]);
					break;
				case "barbarian":
					text = show_barbarian_info(obj[1]);
					break;
				case "city":
					text = show_city_info(obj[1]);
					break;
				case "stronghold":
					text = show_stronghold_info(obj[1]);
					break;
			}
			info_text.text(text);
		}
		else if (filters.influence) {
			mouseover_timer = setTimeout(update_mouseover_influence, 30);
		}
		else {
			info_text.text("");
		}
	}

	function update_mouseover_influence() {
		// show mouseover object info
		var img_data = canvas_ctx.getImageData(mouse_raw[0], mouse_raw[1], 1, 1).data;
		var tribeid = get_tribe_by_color(img_data[0], img_data[1], img_data[2]);
		if (tribeid) {
			info_text.text(get_tribe(tribeid).name);
		}
		else {
			info_text.text("");
		}
	}

	var selected_objects = [];
	var selection_radius = 0, selection_center = [];

	function set_selection(obj) {
		if(obj) {
			selected_objects = [].concat(obj);
		}
		else {
			selected_objects = [];	
		}
		update_selection();
	}

	function add_selection(obj) {
		selected_objects.push(obj);
		update_selection();
	}

	function update_selection() {
		selection_center = calc_selection_center();
		selection_radius = calc_selection_radius();
	}

	function get_selection_center() {
		return selection_center;
	}

	function get_selection_radius() {
		return selection_radius;
	}

	function calc_selection_center() {
		var sum_x = 0, sum_y = 0;
		_(selected_objects).each(function(c) { sum_x += c.x; sum_y += c.y; })
		return [sum_x / selected_objects.length, sum_y / selected_objects.length];
	}

	function calc_selection_radius() {
		var center = get_selection_center();
		var dists_sq = _(selected_objects).map(function(c) {
			var xd = c.x * 4 - center[0] * 4;
			var yd = c.y - center[1];
			return xd*xd + yd*yd;
		});
		return Math.sqrt(_(dists_sq).max());
	}

	function is_selected(obj) {
		// console.log(selected_objects);
		return selected_objects.indexOf(obj) != -1;
	}

	function on_canvas_click() {
		canvas.node().focus();

		var obj = get_object_by_location(mouse_x, mouse_y);
		
		if (obj) {
			set_selection(obj[1]);
			center_map_tile(obj[1].x, obj[1].y);
		}
		else {
			draw();
		}
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
		return sformat("City: {1} / Level {2} / Player: {3}{4}", city.name, city.level, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
	}

	function show_troop_info(troop) {
		var city = get_city(troop.groupId)
		return sformat("Troop: {1} ({2}) / Player: {3}{4}", city.name, troop.troopId, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
	}

	function show_stronghold_info(sh) {
		return sformat("Stronghold: {1} / Level {2} / {3}", sh.name, sh.level, sh.tribeId != 0 && get_tribe(sh.tribeId).name || "Unoccupied");
	}

	var search_input
	var search_results
	
	function object_name_sort_comparer(x, y) {
		return x.name < y.name ? -1 : 1;
	}

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

		// cities
		search_results_cities = search_results.selectAll(".city_search_result").data(match_cities);
		search_results_cities.exit().remove();
		search_results_cities.enter().append("div");
		search_results_cities
			.sort(object_name_sort_comparer)
			.attr("class", "search_result city_search_result")
			.text(function(d) { return "City: " + d.name; })
			.on("click", function(d) { 
				set_selection(d);
				center_map_selection();
			});

		// players
		search_results_players = search_results.selectAll(".player_search_result").data(match_players);
		search_results_players.exit().remove();
		search_results_players.enter().append("div");
		search_results_players
			.sort(object_name_sort_comparer)
			.attr("class", "search_result player_search_result")
			.text(function(d) { return "Player: " + d.name; })
			.on("click", function(d) { 
				var cities = map_data.Cities.filter(function(c) { return c.playerId == d.playerId; });
				set_selection(cities);
				center_map_selection();
			});

		// tribes
		search_results_tribes = search_results.selectAll(".tribe_search_result").data(match_tribes);
		search_results_tribes.exit().remove();
		search_results_tribes.enter().append("div");
		search_results_tribes
			.sort(object_name_sort_comparer)
			.attr("class", "search_result tribe_search_result")
			.text(function(d) { return "Tribe: " + d.name; })
			.on("click", function(d) { 
				var cities = map_data.Cities.filter(function(c) { return c.tribeId == d.tribeId; });
				set_selection(cities);
				center_map_selection();
			});


		// strongholds
		search_results_strongholds = search_results.selectAll(".stronghold_search_result").data(match_strongholds);
		search_results_strongholds.exit().remove();
		search_results_strongholds.enter().append("div");
		search_results_strongholds
			.sort(object_name_sort_comparer)
			.attr("class", "search_result stronghold_search_result")
			.text(function(d) { return "Stronghold: " + d.name; })
			.on("click", function(d) { 
				set_selection(d);
				center_map_selection();
			});
	}

	function center_map_tile(x, y, scale) {
		scale = scale || cur_scale;

		var trans = [(-x * 4) * scale + canvas_width / 2, (-y) * scale + canvas_height / 2];
		var scale = scale;

		transition_zoom(trans, scale, 1000);
	}

	function center_map_selection() {
		var pos = get_selection_center();
		var d = (get_selection_radius() + 110) * 2;
		var scale = Math.max(get_min_zoom_scale(), Math.min(1, canvas_width / d, canvas_height / d));

		center_map_tile(pos[0], pos[1], scale);
	}


	function get_min_zoom_scale() {
		return Math.min(canvas_width / map_width, canvas_height / map_height)
	}

	function resize_canvas() {
		var w = parseInt(content.style("width")) - 0;
		var h = parseInt(content.style("height")) - 0;
		canvas.attr("width", w);
		canvas.attr("height", h);
		canvas.style("width", w + "px");
		canvas.style("height", h + "px");
		canvas_width = w;
		canvas_height = h;
	}

	function init_tribe_colors(data) {
		for (var i = 0; i < data.length; ++i) {
			var tcol = data[i];
			tribe_colors[tcol.tribeId] = tcol.color;
			color_tribes[tcol.color] = tcol.tribeId;
		}
		draw();
	}

	function init_map(data) {
		map_data = data;

		// static info
		d3.select("#snapshot_timestamp").text("Using data from " + new Date(map_data.SnapshotBegin));

		// search
		search_input = d3.select("#search");
		search_input.on("input", function() {
			clearTimeout(do_search_timeout)
			do_search_timeout = setTimeout(do_search, 50);
		});
		search_input.node().focus();

		search_results = d3.select("#search_results");

		// canvas events
		canvas.on("mousemove", on_canvas_mousemove);
		canvas.on("click", on_canvas_click);

		// first draw
		draw();
	}

	var do_search_timeout;
	function init() {
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

		// info texts
		cursor_text = d3.select("#cursor_text");
		info_text = d3.select("#info_text");

		cursor_text.text("Loading..");

		// load resources
		d3.json("tribe_colors.json", function(error, data) {
			if(error) {
				alert("Failed to load the map colors file, reload the page to try again");
			}
			else {
				init_tribe_colors(data);
			}
		});

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

		// init canvas
		content = d3.select("#content");
		canvas = d3.select("canvas");
		canvas_ctx = canvas.node().getContext("2d");
		canvas_ctx.save();

		resize_canvas();

		// init zoom
		cur_scale = get_min_zoom_scale();

		zoom = d3.behavior.zoom()
			.translate(cur_trans)
			.scale(cur_scale)
			.scaleExtent([get_min_zoom_scale(), 1])
			.on("zoom", on_zoom);
		
		canvas.call(zoom);
		
		canvas.on("keydown", function() {
			var step = 100;
			var x = cur_trans[0], y = cur_trans[1];
			console.log(d3.event);
			switch (d3.event.keyCode) {
				// +
				case 187:
					var pos = false;
					var k = Math.log(cur_scale) / Math.LN2;
					var scale = Math.pow(2, pos ? Math.ceil(k) - 1 : Math.floor(k) + 1);
					set_zoom(cur_trans, scale);
					draw();
					break;

				// -
				case 189:
					var pos = true;
					var k = Math.log(cur_scale) / Math.LN2;
					var scale = Math.pow(2, pos ? Math.ceil(k) - 1 : Math.floor(k) + 1);
					set_zoom(cur_trans, scale);
					draw();
					break;


				// DOM_VK_LEFT	0x25 (37)	Left arrow.
				case 37:
					x += step * cur_scale;
					set_zoom([x, y], cur_scale);
					draw();
					break;
				
				// DOM_VK_UP	0x26 (38)	Up arrow.
				case 38:
					y += step * cur_scale;
					set_zoom([x, y], cur_scale);
					draw();
					break;
				
				// DOM_VK_RIGHT	0x27 (39)	Right arrow.
				case 39:
					x -= step * cur_scale;
					set_zoom([x, y], cur_scale);
					draw();
					break;
				
				// DOM_VK_DOWN	0x28 (40)	Down arrow.
				case 40:
					y -= step * cur_scale;
					set_zoom([x, y], cur_scale);
					draw();
					break;
			}
		});
		
		on_zoom();

		d3.select(window).on("resize", function() {
			resize_canvas();

			var min_scale = get_min_zoom_scale() 
			if(zoom.scale() < min_scale || zoom.scale() == zoom.scaleExtent()[0]) {
				zoom.scale(min_scale);
			}
			zoom.scaleExtent([min_scale, 1])

			on_zoom();
		})
	}

	var min_small_text_scale = 0.5;
	var min_normal_text_scale = 0.4;
	var min_large_text_scale = 0.3;
	var font_big = "bold 10pt Arial";
	var font_normal = "10pt Arial";
	var font_small = "8pt Arial";


	function draw_outlined_text(text, x, y, w, outline, fill) {
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
		if (filters.city && cur_scale > min_normal_text_scale) {
			for (var i = 0; i < frame_objects.cities.length; ++i) {
				var city = frame_objects.cities[i];
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
		if (filters.stronghold && cur_scale > min_large_text_scale) {
			for (var i = 0; i < frame_objects.strongholds.length; ++i) {
				var sh = frame_objects.strongholds[i];
				var x = sh.x * 4;
				var y = sh.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.font = font_big;
					canvas_ctx.fillStyle = "black";
					canvas_ctx.textAlign = "center";
					draw_outlined_text(sh.name, x, y + 30 + sh.level * 5, 1, "black", "gold");
				}
			}
		}

		// forests
		if (filters.forest && cur_scale > min_small_text_scale) {
			for (var i = 0; i < frame_objects.forests.length; ++i) {
				var forest = frame_objects.forests[i];
				var x = forest.x * 4;
				var y = forest.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.font = font_small;
					canvas_ctx.fillStyle = "black";
					canvas_ctx.textAlign = "start";
					canvas_ctx.fillText(forest.level, x + 4, y + 12);
				}
			}
		}

		// barbarians
		if (filters.barbarian && cur_scale > min_small_text_scale) {
			for (var i = 0; i < frame_objects.barbarians.length; ++i) {
				var barb = frame_objects.barbarians[i];
				var x = barb.x * 4;
				var y = barb.y;

				if (is_inside_viewport(x, y)) {
					canvas_ctx.font = font_small;
					canvas_ctx.fillStyle = "black";
					canvas_ctx.textAlign = "start";
					canvas_ctx.fillText(barb.level, x + 4, y + 12);
				}
			}
		}
	}

	function draw_circumference(x, y, rad, width, stroke, fill) {
		// colored circunference
		canvas_ctx.moveTo(x, y);
		canvas_ctx.beginPath();
		canvas_ctx.arc(x, y, rad, 0, 2 * Math.PI)
		canvas_ctx.closePath();

		canvas_ctx.strokeStyle = fill;
		canvas_ctx.lineWidth = 8;
		canvas_ctx.stroke();

		if (cur_scale > min_normal_text_scale) {
			// circunference borders
			canvas_ctx.strokeStyle = stroke;
			canvas_ctx.lineWidth = 2;

			canvas_ctx.moveTo(x, y);
			canvas_ctx.beginPath();
			canvas_ctx.arc(x, y, rad + width, 0, 2 * Math.PI)
			canvas_ctx.closePath();
			canvas_ctx.stroke();

			canvas_ctx.moveTo(x, y);
			canvas_ctx.beginPath();
			canvas_ctx.arc(x, y, rad - width, 0, 2 * Math.PI)
			canvas_ctx.closePath();
			canvas_ctx.stroke();
		}
	}

	var draw_text_timeout;

	function draw() {
		if (!map_data) {
			return;
		}

		var start_time = window.performance.now();

		frame_objects.forests.length = 0;
		frame_objects.troops.length = 0;
		frame_objects.barbarians.length = 0;
		frame_objects.cities.length = 0;
		frame_objects.strongholds.length = 0;

		// clear canvas
		canvas_ctx.clearRect(-cur_trans[0] / cur_scale, -cur_trans[1] / cur_scale, canvas_width / cur_scale, canvas_height / cur_scale);
		canvas_ctx.lineCap = "butt";
		canvas_ctx.lineJoin = "miter";

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
					frame_objects.forests.push(forest);

					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.fillStyle = "green";
					canvas_ctx.fill();

					if (cur_scale > min_small_text_scale) {
						canvas_ctx.lineWidth = 1;
						canvas_ctx.strokeStyle = "black";
						canvas_ctx.stroke();
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
					frame_objects.barbarians.push(barb);

					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.fillStyle = "blue";
					canvas_ctx.fill();

					if (cur_scale > min_small_text_scale) {
						canvas_ctx.lineWidth = 1;
						canvas_ctx.strokeStyle = "black";
						canvas_ctx.stroke();
					}
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
					frame_objects.troops.push(troop);

					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.fillStyle = get_tribe_color(troop.tribeId);;
					canvas_ctx.fill();
	
					if (cur_scale > min_small_text_scale) {
						canvas_ctx.lineWidth = 1;
						canvas_ctx.strokeStyle = "black";
						canvas_ctx.stroke();
					}
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
					frame_objects.cities.push(city);
				
					if (cur_scale < min_normal_text_scale) {
						var cw = 7;
						var ch = 4;
						canvas_ctx.fillStyle = get_tribe_color(city.tribeId);
						//canvas_ctx.fillRect(x - cw, y - ch, cw * 2, ch * 2);
						canvas_ctx.beginPath();
						canvas_ctx.rect(x - cw, y - ch, cw * 2, ch * 2);
						canvas_ctx.closePath();
						canvas_ctx.fill();

						// selection border
						if (is_selected(city)) {
							canvas_ctx.strokeStyle = "cyan";
							canvas_ctx.lineWidth = 3;
							canvas_ctx.strokeRect(x - (cw + 1), y - (ch + 1), (cw + 1) * 2, (ch + 1) * 2);
						}
						else {
							canvas_ctx.lineWidth = 1;
							canvas_ctx.strokeStyle = "black";
							canvas_ctx.stroke();//strokeRect(x - (cw + 1), y - (ch + 1), (cw + 1) * 2, (ch + 1) * 2);
						}
					}
					else {
						var cw = 8;
						var ch = 4;

						// fill
						canvas_ctx.beginPath();
						canvas_ctx.moveTo(x - cw, y + 0);
						canvas_ctx.lineTo(x + 0,  y - ch);
						canvas_ctx.lineTo(x + cw, y + 0);
						canvas_ctx.lineTo(x + 0,  y + ch);
						canvas_ctx.closePath();
						canvas_ctx.fillStyle = get_tribe_color(city.tribeId);
						canvas_ctx.fill();

						// selection border
						if (is_selected(city)) {
							var cw_sb = cw + 6;
							var ch_sb = ch + 3;
							canvas_ctx.beginPath();
							canvas_ctx.moveTo(x - cw_sb, y + 0);
							canvas_ctx.lineTo(x + 0,  y - ch_sb);
							canvas_ctx.lineTo(x + cw_sb, y + 0);
							canvas_ctx.lineTo(x + 0,  y + ch_sb);
							canvas_ctx.closePath();
							canvas_ctx.strokeStyle = "cyan";
							canvas_ctx.lineWidth = 3;
							canvas_ctx.stroke();
						}

						// player color border
						var cw_pb = cw;
						var ch_pb = ch;
						canvas_ctx.lineWidth = 2;
						canvas_ctx.strokeStyle = get_player_color(city.playerId);
						canvas_ctx.beginPath();
						canvas_ctx.moveTo(x - cw_pb, y + 0);
						canvas_ctx.lineTo(x + 0,  y - ch_pb);
						canvas_ctx.lineTo(x + cw_pb, y + 0);
						canvas_ctx.lineTo(x + 0,  y + ch_pb);
						canvas_ctx.closePath();
						canvas_ctx.stroke();

						// black border
						var cw_bb = cw + 1;
						var ch_bb = ch + 0.5;
						canvas_ctx.lineWidth = 1.25;
						canvas_ctx.strokeStyle = "black";
						canvas_ctx.beginPath();
						canvas_ctx.moveTo(x - cw_bb, y + 0);
						canvas_ctx.lineTo(x + 0,  y - ch_bb);
						canvas_ctx.lineTo(x + cw_bb, y + 0);
						canvas_ctx.lineTo(x + 0,  y + ch_bb);
						canvas_ctx.closePath();
						canvas_ctx.stroke();
					}
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
					frame_objects.strongholds.push(sh);

					// inner dot
					canvas_ctx.beginPath();
					canvas_ctx.arc(x, y, 5, 0, 2 * Math.PI)
					canvas_ctx.closePath();

					canvas_ctx.fillStyle = get_tribe_color(sh.tribeId);
					canvas_ctx.fill();

					if (cur_scale > min_small_text_scale) {
						canvas_ctx.lineWidth = 1;
						canvas_ctx.strokeStyle = "black";
						canvas_ctx.stroke();
					}

					draw_circumference(x, y, 10 + sh.level * 5, 4, "black", get_tribe_color(sh.tribeId))
				}
			}
		}

		// draw selection
		var pos = get_selection_center();
		var r = get_selection_radius();
		draw_circumference(pos[0] * 4, pos[1], r + 100, 4, "black", "cyan");

		if (cur_scale > min_normal_text_scale) {
			draw_text();
		}
		else {
			clearTimeout(draw_text_timeout)
			draw_text_timeout = setTimeout(draw_text, 10);
		}

		var frame_time = window.performance.now() - start_time;
		last_frame_time = frame_time;
		update_cursor_text();
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
	}

	d3.select(window).on("load", init);
})();