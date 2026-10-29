extends Node3D
const PointArt=preload("res://interaction_art.gd")
const RandomMap = preload("res://maps/p5_scene.gd")
var map_scene = RandomMap.new()
var active_quality := ""
var bridge: JavaScriptObject
var callback: JavaScriptObject
var visibility_callback: JavaScriptObject
var state: Dictionary = {}
var world: Node3D
var actors_root: Node3D
var objects: Dictionary = {}
var avatars: Array[Sprite3D] = []
var region_id := ""
# A newly received floor is built a couple of frames later, so the page can paint its loading veil first.
var pending_region := ""
var pending_frames := 0
# Only the first frame of a floor carries its layout; keep the latest one for deferred (re)builds.
var layout_id := ""
var layout_cache: Dictionary = {}
var region_theme := "T15"
var walk_timer := 0.0
var art_time := 0.0
var font: Font
var sent_art: Dictionary = {}

func _ready() -> void:
	var weighted:=FontVariation.new();weighted.base_font=load("res://fonts/NotoSansSC.ttf");weighted.variation_opentype={"wght":500};weighted.variation_embolden=0.5;font=weighted
	world=Node3D.new();add_child(world)
	actors_root=Node3D.new();add_child(actors_root)
	add_child(map_scene)
	if OS.has_feature("web"):
		bridge=JavaScriptBridge.get_interface("BookseaPlay")
		if bridge!=null:
			callback=JavaScriptBridge.create_callback(_receive);bridge.attach(callback)
			if bridge.registerVisibility!=null:
				visibility_callback=JavaScriptBridge.create_callback(_host_visibility)
				bridge.registerVisibility(visibility_callback)


func _host_visibility(args: Array) -> void:
	if args.size()!=1:return
	var host_visible: bool=bool(args[0])
	# CSS-hiding the canvas does not suspend Godot's scene or render loop.
	# The JS bridge remains callable while the SceneTree is paused.
	get_tree().paused=not host_visible
	RenderingServer.render_loop_enabled=host_visible


func _send(type: String, payload: Dictionary = {}) -> void:
	if bridge!=null:bridge.input(JSON.stringify({"type":type,"payload":payload}))

func _receive(args: Array) -> void:
	if args.size()!=1:return
	var parsed: Variant=JSON.parse_string(str(args[0]))
	if not parsed is Dictionary:return
	state=parsed
	if state.get("mode")=="title":
		pending_region=""
		return
	var region: Dictionary=state.region
	if region.has("layout"):
		layout_id=str(region.id);layout_cache=region.layout
	if region.id!=region_id:
		# New floor: return at once so the page paints its loading veil; _process builds it two frames later.
		if region.id!=pending_region:
			pending_region=str(region.id);pending_frames=2
		return
	_present()

func _build_pending() -> void:
	var region: Dictionary=state.get("region",{})
	var id: String=pending_region
	pending_region=""
	if state.get("mode")=="title" or str(region.get("id",""))!=id:return
	if not region.has("layout"):
		if layout_id!=id:
			push_error("Booksea floor layout missing for "+id)
			return
		region["layout"]=layout_cache
	var desired: String=_graphics_quality()
	active_quality=desired;map_scene.mobile_quality=desired=="mobile";_build_region(region)
	_present()

func _present() -> void:
	var region: Dictionary=state.region
	var desired: String=_graphics_quality()
	if desired!=active_quality:
		active_quality=desired;map_scene.mobile_quality=desired=="mobile";map_scene.apply_floor(map_scene.floor_data);map_scene.apply_actor_position(float(state.x),float(state.z),true)
	map_scene.apply_actor_position(float(state.x),float(state.z))
	world.visible=state.mode in ["explore","event","supplier"]
	# Keep the actual encounter map behind the front-view battle overlay.
	map_scene.world.visible=true
	actors_root.visible=world.visible
	for thing: Dictionary in region.things:
		if objects.has(thing.id) and objects[thing.id].get_meta("kind", "")!=thing.kind:
			var old: Node3D=objects[thing.id];world.remove_child(old);old.queue_free();objects.erase(thing.id)
		if not objects.has(thing.id):_add_thing(thing)
		if objects.has(thing.id):
			var object: Node3D=objects[thing.id];var target: Vector3=_world_pos(thing.x,thing.z);var moved: Vector3=target-object.position
			if moved.length()>.02 and thing.kind=="enemy":
				for child in object.get_children():
					if child is Sprite3D and child.has_meta("monster_id"):
						child.set_meta("clip",("right" if moved.x>0 else "left") if absf(moved.x)>absf(moved.z) else ("down" if moved.z>0 else "up"));child.set_meta("walk_until",art_time+.3)
			object.visible=not thing.used;object.position=target
	var has_active_member: bool=false
	for member: Dictionary in state.party:
		if member.status=="active":has_active_member=true
	for sprite: Sprite3D in avatars:sprite.visible=has_active_member
	_export_supplier_art()
	_export_battle_art()
	bridge.rendered(state.mode,region_id,JSON.stringify(_presentation_metrics()))

func _graphics_quality() -> String:
	# Standard fidelity on every device; only an explicit preference enables low quality.
	var requested: String=str(state.get("settings",{}).get("graphicsQuality","desktop"))
	return "mobile" if requested=="mobile" else "desktop"

func _world_pos(x: float,z: float) -> Vector3:return map_scene._wp(x,z,map_scene._height(x,z))

func _build_region(region: Dictionary) -> void:
	region_id=region.id;region_theme=region.theme
	for n in world.get_children():world.remove_child(n);n.queue_free()
	objects.clear()
	for n in actors_root.get_children():actors_root.remove_child(n);n.queue_free()
	avatars.clear()
	map_scene.apply_floor(region.layout)
	map_scene.apply_actor_position(float(state.x),float(state.z),true)
	for thing: Dictionary in region.things:_add_thing(thing)
	for i in range(mini(1,state.party.size())):
		var sprite:=_add_player_card(actors_root,Color(state.party[i].color),1.0)
		sprite.modulate=Color.WHITE
		sprite.position=_world_pos(state.x,state.z)+Vector3(0,.025,0);avatars.append(sprite)

func _add_thing(thing: Dictionary) -> void:
	var node:=Node3D.new();world.add_child(node);node.position=_world_pos(thing.x,thing.z);objects[thing.id]=node;node.set_meta("kind",thing.kind);node.visible=not thing.used
	match thing.kind:
		"enemy":
			_add_enemy_card(node,str(thing.foes[0]))
		"chest", "mimic":
			node.add_child(PointArt.sprite("chest",.85))
		"supplier":
			node.add_child(PointArt.sprite("supplier",1.6))
		"camp":
			node.add_child(PointArt.sprite("bench",.8))
		"stairs":
			node.add_child(PointArt.sprite("closed-door",2.1))
		"event":
			var book: Sprite3D=PointArt.sprite("event-book",.85)
			book.position.y=.6;book.add_to_group("booksea_event_book");node.add_child(book)
		"exit":
			SliceArt.box(node,Vector3(0,0.03,0),Vector3(0.85,0.05,0.85),Color("79bcb7"))
	var tag:=Label3D.new();tag.text={"enemy":"敌群","chest":"宝箱","mimic":"宝箱","camp":"长椅","supplier":"补给员","stairs":"下一层","event":"事件","exit":"入口"}[thing.kind]
	tag.visible=thing.kind!="enemy"
	tag.font=font;tag.font_size=48;tag.pixel_size=0.010;tag.outline_size=6;tag.position=Vector3(0,1.9 if thing.kind=="supplier" else 1.6,0);tag.billboard=BaseMaterial3D.BILLBOARD_ENABLED;tag.no_depth_test=true;node.add_child(tag)

func _add_player_card(parent: Node3D,color: Color,scale_value: float) -> Sprite3D:
	var sprite:=Sprite3D.new();var atlas:=AtlasTexture.new();atlas.atlas=load("res://assets/heroine.png");atlas.region=Rect2(0,0,192,304);atlas.filter_clip=true
	sprite.texture=atlas;sprite.pixel_size=scale_value*(1.72/288.0);sprite.offset=Vector2(0,144);sprite.billboard=BaseMaterial3D.BILLBOARD_ENABLED;sprite.texture_filter=BaseMaterial3D.TEXTURE_FILTER_NEAREST;sprite.alpha_cut=SpriteBase3D.ALPHA_CUT_DISCARD;parent.add_child(sprite)
	return sprite

func _add_enemy_card(parent: Node3D,id: String) -> Sprite3D:
	var sprite: Sprite3D=MonsterArt.sprite(id,"map");sprite.position.y=.23;parent.add_child(sprite);return sprite

func _process(delta: float) -> void:
	if pending_region!="":
		pending_frames-=1
		if pending_frames<=0:_build_pending()
		return
	if state.is_empty() or state.get("mode")=="title":return
	if not state.paused:
		art_time+=delta
		for sprite in get_tree().get_nodes_in_group("monster_art_sprite"):
			var id: String=str(sprite.get_meta("monster_id"));var direction: String=str(sprite.get_meta("clip"));var clock: float=art_time if art_time<float(sprite.get_meta("walk_until",0.0)) else 0.0
			sprite.texture=MonsterArt.texture(id,"map",MonsterArt.frame_for(id,"map",direction,clock))
			sprite.position.y=.02 if MonsterArt.is_walker(id) else .23+sin(art_time*2.4+float(sprite.get_instance_id()%37)*.17)*.04
	for book: Sprite3D in get_tree().get_nodes_in_group("booksea_event_book"):
		book.position.y=.6+sin(art_time*1.8)*.055
	for i in range(avatars.size()):
		var target:=_world_pos(state.x,state.z)+Vector3(0,.025,0)
		avatars[i].position=avatars[i].position.lerp(target,minf(1,delta*13*float(state.get("settings",{}).get("animationSpeed",1))))
		var atlas: AtlasTexture=avatars[i].texture
		var frame: int=int(art_time*8)%4 if map_scene.moving and not state.paused else 0
		atlas.region=Rect2(frame*192,int(map_scene.facing)*304,192,304)
	walk_timer-=delta
	if state.mode!="explore" or state.paused:return
	if walk_timer<=0:
		var dx:=0;var dz:=0
		if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):dz=-1
		elif Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):dz=1
		elif Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):dx=-1
		elif Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):dx=1
		if dx!=0 or dz!=0:_send("move",{"dx":dx,"dz":dz});walk_timer=0.16

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode==KEY_E or event.physical_keycode==KEY_ENTER:_send("interact")
		elif event.physical_keycode==KEY_ESCAPE:_send("pause")

# The shared accessible RPG overlay is HTML; Godot owns the world and packaged art.
# Export each original portrait once per engine lifetime, not with every 50ms frame.
func _export_supplier_art() -> void:
	if state.get("mode")!="supplier" or bridge==null or sent_art.has("npc-supplier"):return
	var texture: Texture2D=load("res://assets/interactions/supplier-portrait.png")
	var image: Image=texture.get_image()
	if image.is_compressed():image.decompress()
	var accepted: Variant=bridge.art("npc-supplier",Marshalls.raw_to_base64(image.save_png_to_buffer()))
	if accepted==true:sent_art["npc-supplier"]=true

func _export_battle_art() -> void:
	if state.get("mode")!="battle" or bridge==null:return
	for unit: Dictionary in state.battle.units:
		var id: String=str(unit.get("artId",""))
		if id=="" or sent_art.has(id) or not MonsterArt.has_art(id,"battle"):continue
		var image: Image=MonsterArt.texture(id,"battle").get_image()
		if image==null:continue
		if image.is_compressed():image.decompress()
		var accepted: Variant = bridge.art(id,Marshalls.raw_to_base64(image.save_png_to_buffer()))
		if accepted == true:sent_art[id]=true

func _presentation_metrics() -> Dictionary:
	var result: Dictionary=map_scene.metrics()
	result["supplyPoints"]=[]
	for id in objects:
		var node: Node3D=objects[id];var kind: String=str(node.get_meta("kind",""))
		if kind not in ["supplier","event","camp"]:continue
		var art: String=""
		for child in node.get_children():
			if child is Sprite3D:art=child.texture.resource_path
		result.supplyPoints.append({"id":id,"kind":kind,"visible":node.visible,"art":art})
	var viewport_size: Vector2=get_viewport().get_visible_rect().size
	var raster_size: Vector2=get_viewport().get_texture().get_size()
	var pages: Array=[]
	for sprite in get_tree().get_nodes_in_group("monster_art_sprite"):
		if sprite.get_meta("art_kind","")!="map":continue
		pages.append({"height":sprite.pixel_size*float(sprite.get_meta("opaque_height",0)),"position":[sprite.global_position.x,sprite.global_position.y,sprite.global_position.z],"visible":sprite.is_visible_in_tree(),"pixelSize":sprite.pixel_size})
	result.merge({"nativeViewport":[viewport_size.x,viewport_size.y],"rasterSize":[raster_size.x,raster_size.y],"mapPlayerCount":avatars.size(),"playerCell":[192,304],"playerFramesPerDirection":4,"floatingPages":pages,"battleBackdrop":map_scene.world.visible,"battleArtExported":sent_art.size(),"presentation":"rpg-front-view-022"})
	return result
