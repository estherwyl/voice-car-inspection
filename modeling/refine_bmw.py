"""Finish the BMW studio model and re-export its browser asset."""
import bpy, json
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
paint=bpy.data.materials['Black metallic paint']
bs=paint.node_tree.nodes.get('Principled BSDF')
bs.inputs['Metallic'].default_value=.12
bs.inputs['Roughness'].default_value=.32
bs.inputs['Coat Weight'].default_value=.20
for side,label in [(1,'left'),(-1,'right')]:
    points=[(side*.96,1.14,1.10),(side*.95,1.20,1.59),(side*.80,1.73,.75),(side*.82,1.66,.62)]
    data=bpy.data.meshes.new('Sedan rear quarter sail')
    data.from_pydata([(x*.95,-z*1.08,y*.84) for x,y,z in points],[],[(0,1,2,3)])
    obj=bpy.data.objects.new(label+' rear quarter sail',data);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(paint);obj['partId']=label+'-rear-fender';obj['surface']='exterior'
    matrix=obj.matrix_world.copy();obj.parent=bpy.data.objects['part-'+label+'-rear-fender'];obj.matrix_world=matrix
    mod=obj.modifiers.new('Sail panel thickness','SOLIDIFY');mod.thickness=.015
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.name.startswith('part-') or o.parent and o.parent.name.startswith('part-'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/bmw-330i-inspection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_animations=False)
meta_path=ROOT/'public/models/bmw-model-metadata.json'
meta=json.loads(meta_path.read_text())
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent and o.parent.name.startswith('part-')]
meta['mesh_count']=len(meshes)
meta['triangles']=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
for name,details in meta['parts'].items():
    root=bpy.data.objects['part-'+name]
    details['pivot']=[root.location.x,root.location.z,-root.location.y]
    details['meshes']=len(root.children)
meta_path.write_text(json.dumps(meta,indent=2)+'\n')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'modeling/bmw-330i-inspection.blend'))
bpy.context.scene.render.filepath=str(ROOT/'public/models/bmw-330i-studio.png')
bpy.ops.render.render(write_still=True)
