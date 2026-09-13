"""Original Subaru-XV-inspired inspection reference, built with Blender.
Run with Blender's bundled bpy runtime; tooling venv is activated by build.sh.
Coordinates below use glTF / Three.js Y-up, nose at negative Z, vehicle left +X.
"""
import bpy, math, json, os
from mathutils import Vector
from collections import defaultdict
from pathlib import Path
from math import sin, cos, pi
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

def vec(p): return Vector((p[0],-p[2],p[1]))
def mat(name, color, metallic=0, rough=.4, coat=0, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic;bs.inputs['Roughness'].default_value=rough
    bs.inputs['Coat Weight'].default_value=coat;bs.inputs['Coat Roughness'].default_value=.18
    if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m
PAINT=mat('Ceramic pearl white',(.76,.81,.80),.38,.25,.65)
TRIM=mat('Satin wheel-arch polymer',(.024,.032,.033),.05,.6)
RUBBER=mat('Tyre rubber',(.011,.015,.017),0,.85)
GLASS=mat('Smoked solar glass',(.034,.08,.103),.55,.14,.7)
CHROME=mat('Brushed alloy',(.47,.53,.56),.87,.24)
DARKMETAL=mat('Graphite metal',(.045,.060,.067),.75,.3)
LEATHER=mat('Graphite perforated leather',(.042,.054,.055),0,.8)
SEATINSERT=mat('Leather seat insert',(.069,.081,.08),0,.85)
THREAD=mat('Warm ivory contrast stitching',(.4,.48,.44),0,.8)
SCREEN=mat('Instrument display',(.055,.26,.29),.3,.23,.2,.25)
HEADLIGHT=mat('LED lens',(.80,.92,1),.5,.15,.7)
LED=mat('Daytime LED strip',(.88,.97,1),.2,.18,0,.7)
RED=mat('Rear lamp red lens',(.34,.013,.009),.4,.23,.6)
AMBER=mat('Signal amber',(.8,.23,.015),.3,.25)
BADGE=mat('Midnight blue badge',(.013,.04,.12),.6,.2,.6)
BELT=mat('Seatbelt webbing',(.026,.031,.029),0,.94)
CALIPER=mat('Brake caliper',(.23,.055,.035),.5,.32)
parts={}; members=defaultdict(list)
pivots={
'left-front-door':(1,.95,-.5),'right-front-door':(-1,.95,-.5),
'left-rear-door':(1,.95,.65),'right-rear-door':(-1,.95,.65),
'left-front-fender':(1,.85,-1.57),'right-front-fender':(-1,.85,-1.57),
'left-rear-fender':(1,.9,1.64),'right-rear-fender':(-1,.9,1.64),
'left-mirror':(1.07,1.26,-.94),'right-mirror':(-1.07,1.26,-.94),
'left-front-wheel':(.99,.43,-1.42),'right-front-wheel':(-.99,.43,-1.42),
'left-rear-wheel':(.99,.43,1.44),'right-rear-wheel':(-.99,.43,1.44),
'bonnet':(0,1.07,-1.58),'boot':(0,1.06,2.02),'front-bumper':(0,.69,-2.14),'rear-bumper':(0,.67,2.1),
'windshield':(0,1.39,-.77),'rear-glass':(0,1.43,1.52),'roof':(0,1.75,.36),'lights':(0,1.0,-2.11),
'driver-seat':(-.47,.88,-.23),'passenger-seat':(.47,.88,-.23),'rear-seat':(0,.89,1.0),
'dashboard':(0,1.1,-.93),'steering':(-.49,1.29,-.54),'console':(0,.72,.2),'belts':(.82,1.2,.15),
'cabin-trim':(.85,.98,.5),'engine':(0,.79,-1.55),'underbody':(0,.32,0)
}
for name,p in pivots.items():
    obj=bpy.data.objects.new('part-'+name,None);bpy.context.collection.objects.link(obj);obj.location=vec(p)
    obj['partId']=name;obj['model']='Original approximate 2022 XV GT reference';parts[name]=obj
bpy.context.view_layer.update()
def register(obj,name,part,material,surface='exterior',smooth=True):
    obj.name=name;obj.data.materials.append(material);obj['surface']=surface;obj['partId']=part
    members[part].append(obj)
    if smooth and hasattr(obj.data,'polygons'):
        for poly in obj.data.polygons:poly.use_smooth=True
    return obj

def mesh(name,verts,faces,material,part,bevel=0,solid=0,surface='exterior',smooth=True):
    data=bpy.data.meshes.new(name);data.from_pydata([vec(p) for p in verts],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    register(obj,name,part,material,surface,smooth)
    if solid:
        mod=obj.modifiers.new('Panel thickness','SOLIDIFY');mod.thickness=solid
    if bevel:
        mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
    return obj

def box(name,center,size,material,part,bevel=.018,surface='exterior',rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=vec(center));obj=bpy.context.object
    obj.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    register(obj,name,part,material,surface,False)
    if rotation:obj.rotation_euler=rotation
    if bevel:
        m=obj.modifiers.new('Precision edge radii','BEVEL');m.width=bevel;m.segments=4
        n=obj.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL');n.keep_sharp=True;n.weight=50
    return obj

def tube(name,points,radius,material,part,surface='exterior',cyclic=False):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8;curve.bevel_depth=radius;curve.bevel_resolution=2
    spl=curve.splines.new('POLY');spl.points.add(len(points)-1)
    for p,co in zip(spl.points,points):p.co=(*vec(co),1)
    spl.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);register(obj,name,part,material,surface)
    return obj

def cyl(name,center,radius,depth,material,part,axis=(1,0,0),vertices=48,surface='exterior'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=vec(center));obj=bpy.context.object
    obj.rotation_euler=vec(axis).to_track_quat('Z','Y').to_euler();register(obj,name,part,material,surface)
    bevel=obj.modifiers.new('Machined edge','BEVEL');bevel.width=.004;bevel.segments=2
    return obj

def torus(name,center,major,minor,material,part,axis=(1,0,0),surface='exterior',segments=64):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments,minor_segments=10,location=vec(center),major_radius=major,minor_radius=minor)
    obj=bpy.context.object;obj.rotation_euler=vec(axis).to_track_quat('Z','Y').to_euler();register(obj,name,part,material,surface);return obj

def patch(name,fn,nu,nv,material,part,thickness=.015,surface='exterior'):
    verts=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    faces=[]
    for j in range(nv):
        for i in range(nu):a=j*(nu+1)+i;faces.append((a,a+1,a+nu+2,a+nu+1))
    return mesh(name,verts,faces,material,part,solid=thickness,surface=surface)

def lerp(a,b,t):return a*(1-t)+b*t

def sidepoint(side,z,y,offset=0):
    width=.94 + .037*sin((y-.4)/.8*pi)
    if y>1.14:width=lerp(.962,.786,min(1,(y-1.14)/.59))
    return (side*(width+offset),y,z)

# Underfloor and rocker moldings: separate from bodywork and hidden in flat exterior inventory unless selected.
box('Underfloor pan',(0,.35,0),(1.77,.14,3.85),TRIM,'underbody',.10)
for side in [-1,1]:
    box('Boxed chassis rail',(side*.56,.30,.1),(.13,.12,3.6),DARKMETAL,'underbody',.025)
    tube('Exhaust pipe',[(side*.22,.26,-1.15),(side*.22,.24,.4),(side*.32,.25,1.8)],.033,CHROME,'underbody')
    cyl('Exhaust tip',(side*.60,.43,2.20),.065,.20,CHROME,'rear-bumper',axis=(0,0,1))
    cyl('Exhaust outlet',(side*.60,.43,2.31),.05,.012,TRIM,'rear-bumper',axis=(0,0,1))
box('Fuel / driveline guard',(0,.29,.65),(.78,.12,1.1),DARKMETAL,'underbody',.06)

# Four separately sculpted doors, their glazing, window seals, and interior trims.
for side,label in [(1,'left'),(-1,'right')]:
    for end,z0,z1 in [('front',-.99,.066),('rear',.084,1.06)]:
        part=f'{label}-{end}-door'
        def doorfn(u,v,z0=z0,z1=z1,side=side,end=end):
            z=lerp(z0,z1,u)+(u*u*.07*v if end=='rear' else 0)
            y=lerp(.49,1.14,v);x,y,z=sidepoint(side,z,y)
            return (x+side*.014*sin(pi*u)*sin(pi*v),y,z)
        patch('Sculpted door outer skin',doorfn,18,12,PAINT,part,.022)
        # Lower sweep, body line, rubber weather seal and handle recess.
        tube('Lower door crease',[sidepoint(side,lerp(z0+.025,z1-.025,t),.63+.025*sin(pi*t),.009) for t in [i/20 for i in range(21)]],.005,CHROME,part)
        tube('Beltline chrome',[sidepoint(side,lerp(z0+.008,z1-.008,t),1.153,.012) for t in [i/24 for i in range(25)]],.011,CHROME,part)
        box('Rocker panel',(side*.97,.43,(z0+z1)/2),(.085,.105,z1-z0-.015),TRIM,part,.025)
        box('GT rocker inlay',(side*1.017,.424,(z0+z1)/2),(.013,.035,z1-z0-.08),CHROME,part,.008)
        hz=z1-.22;hy=1.01
        box('Handle recess',(side*.983,hy,hz),(.025,.065,.23),DARKMETAL,part,.022)
        box('Body-color pull handle',(side*1.01,hy+.007,hz),(.055,.038,.19),PAINT,part,.014)
        if end=='front':
            polygon=[sidepoint(side,z0+.04,1.18),sidepoint(side,.028,1.18),sidepoint(side,.028,1.699),sidepoint(side,-.47,1.686),sidepoint(side,z0+.04,1.205)]
        else:
            polygon=[sidepoint(side,.13,1.18),sidepoint(side,1.095,1.18),sidepoint(side,1.09,1.64),sidepoint(side,.15,1.70)]
        mesh('Solar side glass',polygon,[tuple(range(len(polygon)))],GLASS,part,solid=.016)
        tube('Window weather seal',polygon,.020,TRIM,part,cyclic=True)
        tube('Upper chrome glass surround',[polygon[i] for i in range(1,len(polygon))],.009,CHROME,part)
        if end=='rear':tube('Rear quarter divider',[sidepoint(side,.83,1.18,.012),sidepoint(side,.85,1.656,.012)],.018,TRIM,part)
        # Door interior exposed in cutaway interior mode, kept with the same inspection identity.
        box('Interior door upholstered panel',(side*.90,.87,(z0+z1)/2),(.09,.49,z1-z0-.08),LEATHER,part,.055,'interior')
        box('Interior door armrest',(side*.82,.91,(z0+z1)/2),(.19,.12,.52),SEATINSERT,part,.028,'interior')
        box('Satin interior door pull',(side*.84,1.06,z0+.30),(.024,.045,.17),CHROME,part,.012,'interior')
        box('Power window switch',(side*.80,.986,z0+.35),(.055,.02,.055),TRIM,part,.006,'interior')
        for t in range(6):tube('Door speaker grille',[(side*.84,.63+t*.017,z0+.18),(side*.84,.63+t*.017,z0+.39)],.003,THREAD,part,'interior')
        tube('Door upholstery stitch',[(side*.845,1.07,lerp(z0+.1,z1-.1,i/35)) for i in range(36)],.0025,THREAD,part,'interior')
    # Distinct front and rear fenders with real wheel arch cutouts.
    for end,zc,zlo,zhi,top in [('front',-1.42,-2.13,-1.00,1.13),('rear',1.44,1.071,2.13,1.19)]:
        part=f'{label}-{end}-fender';radius=.437
        outline=[sidepoint(side,zlo,.43),sidepoint(side,zlo,top-.07),sidepoint(side,zhi,top),sidepoint(side,zhi,.43),sidepoint(side,zc+radius,.43)]
        outline += [sidepoint(side,zc+radius*cos(t),.43+radius*sin(t),.01) for t in [i*pi/48 for i in range(49)]]
        outline += [sidepoint(side,zlo,.43)]
        mesh('Quarter panel with wheel cutout',outline,[tuple(range(len(outline)))],PAINT,part,bevel=.012,solid=.025)
        tube('Raised wheel arch cladding',[sidepoint(side,zc+.454*cos(t),.43+.454*sin(t),.041) for t in [i*pi/64 for i in range(65)]],.032,TRIM,part)
        if end=='rear':
            # Rear quarter light ties the D pillar into hatch.
            q=[sidepoint(side,1.15,1.215),sidepoint(side,1.77,1.23),sidepoint(side,1.43,1.60),sidepoint(side,1.17,1.64)]
            mesh('Rear fixed quarter glass',q,[(0,1,2,3)],GLASS,part,solid=.015)
            tube('Quarter glass black surround',q,.025,TRIM,part,cyclic=True)
            tube('D pillar outer frame',[sidepoint(side,1.11,1.70),sidepoint(side,1.46,1.63),sidepoint(side,1.91,1.17)],.065,PAINT,part)
            if side==-1:box('Fuel filler lid',(side*.977,1.0,1.68),(.028,.16,.20),PAINT,part,.03)
    # Mirror assembly, lower stalk, reflective rear surface and indicator.
    part=f'{label}-mirror'
    tube('Mirror stalk',[sidepoint(side,-.88,1.23),(side*1.11,1.27,-.91)],.025,TRIM,part)
    box('Mirror lower housing',(side*1.11,1.278,-.92),(.28,.16,.30),TRIM,part,.065)
    box('Pearl mirror cap',(side*1.11,1.321,-.95),(.275,.095,.26),PAINT,part,.045)
    box('Mirror reflective glass',(side*1.115,1.284,-.76),(.223,.107,.016),GLASS,part,.025)
    tube('Mirror indicator',[(side*1.21,1.294,-1.059),(side*1.07,1.294,-1.07),(side*.998,1.29,-1.04)],.006,HEADLIGHT,part)

# Bonnet compound surface, sculpted creases and windshield flush with roof.
def hoodfn(u,v):
    x=lerp(-.92,.92,u)*(1-.03*cos(pi*v));z=lerp(-2.08,-1.01,v)
    y=lerp(1.015,1.145,v)+.034*sin(pi*u)+.012*sin(pi*v)
    y+=.014*math.exp(-((abs(x)-.58)/.11)**2)
    return (x,y,z)
patch('Compound curvature bonnet',hoodfn,36,24,PAINT,'bonnet',.022)
for side in [-1,1]:tube('Bonnet character ridge',[(side*lerp(.72,.58,t),lerp(1.027,1.179,t),lerp(-2.02,-1.05,t)) for t in [i/30 for i in range(31)]],.003,CHROME,'bonnet')
box('Bonnet underside insulation',(0,1.045,-1.52),(1.3,.025,.68),TRIM,'bonnet',.08)
patch('Laminated curved windshield',lambda u,v:(lerp(-.891,.891,u)*(1-.13*v),lerp(1.16,1.705,v)+.009*sin(pi*u),lerp(-1.02,-.465,v)-.032*sin(pi*u)),32,20,GLASS,'windshield',.018)
for side in [-1,1]:
    tube('A pillar painted rail',[(side*lerp(.934,.81,t),lerp(1.15,1.73,t),lerp(-1.04,-.47,t)) for t in [i/25 for i in range(26)]],.032,PAINT,'roof')
    tube('Wiper blade',[(side*.10,1.176,-1.045),(side*.35,1.20,-1.01),(side*.70,1.237,-.98)],.012,TRIM,'windshield')
patch('Crowned roof panel',lambda u,v:(lerp(-.80,.80,u),1.732+.026*sin(pi*u)+.015*sin(pi*v),lerp(-.48,1.24,v)),32,32,PAINT,'roof',.025)
for side in [-1,1]:
    tube('Roof rail top',[(side*.674,1.79+.046*sin(pi*t),lerp(-.30,1.14,t)) for t in [i/36 for i in range(37)]],.025,DARKMETAL,'roof')
    for z in [-.28,1.13]:box('Roof rail foot',(side*.674,1.76,z),(.065,.08,.15),TRIM,'roof',.024)
    tube('B pillar painted edge',[sidepoint(side,.073,1.135),sidepoint(side,.073,1.71)],.025,TRIM,'roof')
box('Shark-fin antenna',(0,1.799,1.07),(.06,.065,.16),DARKMETAL,'roof',.03)
patch('Heated rear hatch glass',lambda u,v:(lerp(-.854,.854,u)*(1-.09*v),lerp(1.22,1.68,v),lerp(1.89,1.245,v)),30,18,GLASS,'rear-glass',.018)
for i in range(1,10):
    t=i/11;tube('Rear screen defroster',[(lerp(-.8,.8,j/20)*(1-.09*t),lerp(1.224,1.684,t),lerp(1.898,1.253,t)) for j in range(21)],.0017,CHROME,'rear-glass')
tube('Rear wiper',[(.03,1.232,1.91),(.22,1.25,1.88),(.53,1.27,1.84)],.012,TRIM,'rear-glass')
# Hatch outer face and GT roof spoiler.
patch('Sculpted tailgate',lambda u,v:(lerp(-.92,.92,u),lerp(.65,1.22,v),2.10-.20*v+.025*sin(pi*u)),32,16,PAINT,'boot',.035)
box('Rear plate recess',(0,.94,2.056),(.66,.20,.04),TRIM,'boot',.025)
box('Rear registration plate',(0,.946,2.082),(.48,.11,.016),CHROME,'boot',.006)
box('Tailgate release',(0,1.071,2.044),(.26,.03,.026),DARKMETAL,'boot',.01)
box('GT roof spoiler',(0,1.732,1.405),(1.70,.058,.38),PAINT,'boot',.04)
box('Spoiler dark trailing edge',(0,1.717,1.601),(1.67,.027,.025),TRIM,'boot',.008)
box('High-mounted brake lamp',(0,1.721,1.613),(.38,.018,.015),RED,'boot',.007)

# Layered bumpers with black grille, honeycomb, fog lamps, splitters, sensors, and DRLs.
box('Front fascia',(0,.796,-2.113),(1.89,.42,.23),PAINT,'front-bumper',.14)
box('Upper grille black surround',(0,1.01,-2.222),(.94,.23,.075),TRIM,'front-bumper',.065)
box('Upper grille inner',(0,1.02,-2.265),(.81,.15,.025),DARKMETAL,'front-bumper',.045)
box('Lower air intake',(0,.67,-2.246),(1.03,.16,.045),TRIM,'front-bumper',.028)
for k in range(17):
    x=-.37+k*.046
    for j in range(3):
        y=.978+j*.035;pts=[(x+.017*cos(a),y+.017*sin(a),-2.283) for a in [i*pi/3 for i in range(6)]]
        tube('Hex grille cell',pts,.0029,CHROME,'front-bumper',cyclic=True)
for j in range(4):tube('Lower intake horizontal slat',[(-.46,.61+j*.031,-2.276),(.46,.61+j*.031,-2.276)],.0045,DARKMETAL,'front-bumper')
for side in [-1,1]:
    box('Front fog lamp dark bezel',(side*.77,.702,-2.19),(.29,.21,.13),TRIM,'front-bumper',.055)
    cyl('Fog lens',(side*.77,.72,-2.263),.065,.015,HEADLIGHT,'lights',axis=(0,0,-1))
    torus('Fog lamp surround',(side*.77,.72,-2.275),.068,.008,CHROME,'lights',axis=(0,0,-1),segments=40)
    box('GT bumper corner aero',(side*.80,.54,-2.19),(.31,.07,.24),DARKMETAL,'front-bumper',.026)
    cyl('Parking sensor',(side*.48,.81,-2.246),.013,.008,TRIM,'front-bumper',axis=(0,0,-1),vertices=20)
box('Front lower skid plate',(0,.502,-2.181),(1.03,.10,.18),CHROME,'front-bumper',.025)
box('Front GT lip',(0,.458,-2.245),(1.95,.055,.11),TRIM,'front-bumper',.018)
box('Front registration plate',(0,.79,-2.274),(.47,.12,.017),DARKMETAL,'front-bumper',.007)
box('Rear bumper body',(0,.64,2.125),(1.94,.27,.28),PAINT,'rear-bumper',.09)
box('Rear lower diffuser',(0,.476,2.152),(1.93,.15,.26),TRIM,'rear-bumper',.045)
box('Rear skid insert',(0,.486,2.29),(.94,.10,.035),CHROME,'rear-bumper',.02)
for side in [-1,1]:
    box('Rear reflector surround',(side*.76,.596,2.263),(.27,.088,.028),TRIM,'rear-bumper',.022)
    box('Rear reflector',(side*.76,.607,2.285),(.22,.043,.014),RED,'rear-bumper',.012)
    for x in [.48,.80]:cyl('Rear parking sensor',(side*x,.737,2.221),.012,.01,TRIM,'rear-bumper',axis=(0,0,1),vertices=20)
# Angular headlamps with projector rings and signature C strips, all one selectable lighting assembly.
for side in [-1,1]:
    verts=[(side*.5,1.08,-2.243),(side*.90,1.11,-2.16),(side*.96,1.045,-2.115),(side*.9,.957,-2.186),(side*.51,.969,-2.246)]
    mesh('Headlamp angular outer lens',verts,[(0,1,2,3,4)],GLASS,'lights',bevel=.012,solid=.028)
    for x in [.63,.81]:
        cyl('LED projector reflector',(side*x,1.031,-2.24),.052,.025,CHROME,'lights',axis=(0,0,-1))
        cyl('LED projector glass',(side*x,1.031,-2.262),.038,.014,HEADLIGHT,'lights',axis=(0,0,-1))
        torus('Projector angel ring',(side*x,1.031,-2.273),.042,.005,LED,'lights',axis=(0,0,-1),segments=36)
    tube('C-shaped signature running light',[(side*.56,1.091,-2.271),(side*.86,1.113,-2.23),(side*.916,1.078,-2.181),(side*.893,.987,-2.224),(side*.68,.974,-2.275)],.008,LED,'lights')
    # Tail lamp wraps rear corners.
    box('Rear lamp housing',(side*.824,1.15,1.986),(.30,.24,.17),TRIM,'lights',.053)
    box('Rear lamp red outer lens',(side*.825,1.163,2.075),(.264,.185,.027),RED,'lights',.035)
    tube('Rear LED signature',[(side*.726,1.219,2.094),(side*.924,1.219,2.094),(side*.94,1.10,2.084),(side*.818,1.096,2.095)],.011,RED,'lights')
    box('Tail reverse lamp',(side*.848,1.122,2.094),(.135,.028,.012),HEADLIGHT,'lights',.008)
# Original oval emblems (not a licensed manufacturer logo).
for z,y in [(-2.306,1.036),(2.044,1.15)]:
    emblem=cyl('Oval reference badge',(0,y,z),.056,.012,CHROME,'front-bumper' if z<0 else 'boot',axis=(0,0,1));emblem.scale.x=1.8
    emblem=cyl('Oval blue badge inset',(0,y,z+(-.009 if z<0 else .009)),.047,.014,BADGE,'front-bumper' if z<0 else 'boot',axis=(0,0,1));emblem.scale.x=1.8

# Detailed 18-inch-style wheels, tire tread, five split spokes, hubs, lug nuts, rotors and calipers.
for side,label in [(1,'left'),(-1,'right')]:
 for end,zc in [('front',-1.42),('rear',1.44)]:
    part=f'{label}-{end}-wheel';cx=side*.981;cy=.43
    torus('High-resolution tyre carcass',(cx,cy,zc),.329,.078,RUBBER,part,segments=80)
    for offset in [-.062,.062]:torus('Tyre sidewall bead',(cx+offset,cy,zc),.324,.010,RUBBER,part,segments=80)
    # Carefully aligned tread blocks around circumference, three staggered bands.
    for lane in [-1,0,1]:
      for i in range(64):
        a=(i+(lane%2)*.48)*2*pi/64;rr=.402
        obj=box('Directional tread block',(cx+lane*.046,cy+rr*sin(a),zc+rr*cos(a)),(.043,.012,.03),RUBBER,part,.0015)
        obj.rotation_euler[0]=pi/2-a
    cyl('Alloy rim barrel',(cx,cy,zc),.287,.165,CHROME,part)
    cyl('Graphite wheel recess',(cx+side*.09,cy,zc),.257,.017,DARKMETAL,part)
    cyl('Ventilated brake disc',(cx+side*.068,cy,zc),.219,.015,CHROME,part,vertices=64)
    torus('Polished rim edge',(cx+side*.103,cy,zc),.272,.012,CHROME,part,segments=72)
    for i in range(28):
        a=i*2*pi/28
        cyl('Rotor ventilation dimple',(cx+side*.078,cy+.19*sin(a),zc+.19*cos(a)),.007,.002,TRIM,part,vertices=8)
    box('Brake caliper casting',(cx+side*.082,cy+.02,zc+.196),(.043,.135,.056),CALIPER,part,.02)
    for i in range(5):
      a=i*2*pi/5
      for branch in [-1,1]:
        a0=a+branch*.11;a1=a+branch*.20
        start=(cx+side*.122,cy+.063*sin(a0),zc+.063*cos(a0));endp=(cx+side*.116,cy+.254*sin(a1),zc+.254*cos(a1))
        # A tapered machined spoke blade with dark inner extrusion.
        dx=.015;perp=(cos(a1),-sin(a1));w0=.018;w1=.009
        verts=[(start[0],start[1]+perp[0]*w0,start[2]+perp[1]*w0),(endp[0],endp[1]+perp[0]*w1,endp[2]+perp[1]*w1),(endp[0],endp[1]-perp[0]*w1,endp[2]-perp[1]*w1),(start[0],start[1]-perp[0]*w0,start[2]-perp[1]*w0)]
        mesh('Diamond-cut split spoke',verts,[(0,1,2,3)],CHROME,part,bevel=.003,solid=.016)
      cyl('Hex lug nut',(cx+side*.139,cy+.059*sin(a),zc+.059*cos(a)),.012,.018,DARKMETAL,part,vertices=6)
    cyl('Alloy wheel center cap',(cx+side*.146,cy,zc),.04,.018,CHROME,part,vertices=40)
    cyl('Wheel center blue insert',(cx+side*.158,cy,zc),.027,.005,BADGE,part,vertices=32)
    # Suspension visible when inspecting underbody.
    cyl('Damper tube',(side*.76,.66,zc),.027,.53,DARKMETAL,'underbody',axis=(0,1,0))
    tube('Suspension coil',[(side*.76+.067*cos(t),.47+t/(pi*2*6)*.38,zc+.067*sin(t)) for t in [i*pi*2*6/140 for i in range(141)]],.008,CHROME,'underbody')

# Cabin seats: shaped bolsters, perforated inserts, piping, headrests, stitching and adjustment controls.
def buildseat(part,cx,cz,width=.65,rear=False):
    surf='interior';seat_y=.62
    box('Seat pedestal',(cx,.44,cz),(width*.7,.20,.46),TRIM,part,.055,surf)
    box('Leather seat cushion',(cx,seat_y,cz),(width,.18,.62),LEATHER,part,.075,surf)
    box('Seat cushion insert',(cx,seat_y+.094,cz-.025),(width*.63,.025,.46),SEATINSERT,part,.04,surf)
    for side in [-1,1]:
        box('Cushion side bolster',(cx+side*width*.405,seat_y+.05,cz),(.115,.14,.59),LEATHER,part,.05,surf)
        box('Seat back side bolster',(cx+side*width*.402,1.01,cz+.246),(.12,.65,.18),LEATHER,part,.055,surf)
    back=box('Contoured seat back',(cx,1.012,cz+.288),(width,.70,.18),LEATHER,part,.085,surf);back.rotation_euler.x=.1
    box('Seat back insert',(cx,1.03,cz+.18),(width*.62,.52,.022),SEATINSERT,part,.05,surf)
    for x in [cx-width*.14,cx+width*.14]:cyl('Headrest polished post',(x,1.45,cz+.306),.011,.14,CHROME,part,axis=(0,1,0),vertices=16,surface=surf)
    box('Adjustable headrest',(cx,1.52,cz+.30),(width*.64,.20,.16),LEATHER,part,.055,surf)
    for side in [-1,1]:
        tube('Backrest contrast piping',[(cx+side*width*.29,.81,cz+.169),(cx+side*width*.30,1.25,cz+.169),(cx+side*width*.20,1.31,cz+.172)],.0024,THREAD,part,surf)
        for i in range(25):
            y=.79+i*.02;tube('Seat seam stitch',[(cx+side*width*.32,y,cz+.18),(cx+side*width*.32,y+.007,cz+.18)],.0013,THREAD,part,surf)
    for row in range(16):
      for col in range(8):
        cyl('Leather perforation',(cx+(col-3.5)*width*.06,.82+row*.027,cz+.163),.0017,.002,TRIM,part,axis=(0,0,-1),vertices=5,surface=surf)
    box('Seat adjustment handle',(cx+width*.49,.52,cz-.07),(.027,.04,.13),DARKMETAL,part,.008,surf)
    box('Seat belt buckle',(cx-width*.57,.73,cz+.15),(.04,.09,.06),TRIM,part,.014,surf)
    box('Buckle release button',(cx-width*.57,.78,cz+.15),(.033,.009,.036),RED,part,.004,surf)
buildseat('driver-seat',-.465,-.18)
buildseat('passenger-seat',.465,-.18)
for x in [-.56,0,.56]:buildseat('rear-seat',x,1.03,.52,True)
# Cabin floor and upholstery lining.
box('Carpeted cabin floor',(0,.48,.44),(1.67,.035,2.22),LEATHER,'cabin-trim',.035,'interior')
for x in [-.47,.47]:
    box('Front floor mat',(x,.507,-.49),(.53,.019,.62),TRIM,'cabin-trim',.04,'interior')
    for i in range(9):tube('Floor mat rib',[(x-.20+i*.05,.52,-.70),(x-.20+i*.05,.52,-.27)],.0025,LEATHER,'cabin-trim','interior')
# Dashboard molded form, cluster housing, twin dials, digital screen and center controls.
box('Full width soft-touch dashboard',(0,1.052,-.888),(1.71,.33,.39),LEATHER,'dashboard',.105,'interior')
box('Dashboard lower knee bolster',(0,.854,-.93),(1.62,.26,.26),TRIM,'dashboard',.07,'interior')
box('Passenger dash silver inlay',(.43,1.062,-.657),(.66,.065,.014),CHROME,'dashboard',.014,'interior')
box('Glove compartment face',(.43,.885,-.732),(.59,.19,.04),LEATHER,'dashboard',.03,'interior')
box('Glove box release',(.43,.97,-.702),(.105,.02,.01),CHROME,'dashboard',.006,'interior')
box('Instrument hood',(-.475,1.238,-.78),(.57,.15,.30),TRIM,'dashboard',.065,'interior')
for cx in [-.625,-.331]:
    cyl('Gauge dial bezel',(cx,1.215,-.611),.106,.015,CHROME,'dashboard',axis=(0,0,1),surface='interior')
    cyl('Gauge dial face',(cx,1.215,-.60),.096,.01,TRIM,'dashboard',axis=(0,0,1),surface='interior')
    for i in range(13):
        a=lerp(-.2*pi,1.2*pi,i/12)
        tube('Gauge tick',[(cx+.076*cos(a),1.215+.076*sin(a),-.591),(cx+.086*cos(a),1.215+.086*sin(a),-.591)],.002,HEADLIGHT,'dashboard','interior')
    tube('Gauge needle',[(cx,1.215,-.587),(cx-.05,1.27,-.587)],.0025,RED,'dashboard','interior')
box('Central instrument display',(-.479,1.219,-.593),(.085,.10,.01),SCREEN,'dashboard',.004,'interior')
box('Infotainment bezel',(.115,1.094,-.65),(.46,.30,.075),DARKMETAL,'dashboard',.035,'interior')
box('Infotainment glass display',(.115,1.119,-.602),(.356,.198,.012),SCREEN,'dashboard',.018,'interior')
for i in range(4):box('Display interface line',(.075,1.16-i*.034,-.594),(.22-i*.017,.009,.003),HEADLIGHT,'dashboard',.002,'interior')
for x in [-.07,.30]:cyl('Audio rotary encoder',(x,.988,-.607),.022,.026,CHROME,'dashboard',axis=(0,0,1),vertices=32,surface='interior')
for x in [-.73,.47,.73]:
    box('Air vent surround',(x,1.15,-.675),(.17,.115,.02),CHROME,'dashboard',.02,'interior')
    box('Air vent aperture',(x,1.15,-.660),(.149,.093,.016),TRIM,'dashboard',.016,'interior')
    for i in range(5):box('Directional vent slat',(x,1.112+i*.017,-.646),(.132,.008,.014),DARKMETAL,'dashboard',.003,'interior')
for x in [-.035,.115,.265]:
    cyl('Climate control knob',(x,.893,-.619),.041,.043,TRIM,'dashboard',axis=(0,0,1),vertices=40,surface='interior')
    torus('Climate dial chrome ring',(x,.893,-.594),.035,.005,CHROME,'dashboard',axis=(0,0,1),surface='interior',segments=32)
# Steering wheel correct right-hand-drive position.
part='steering';sc=(-.478,1.205,-.42)
torus('Leather steering wheel rim',sc,.208,.025,LEATHER,part,axis=(0,.3,1),surface='interior')
box('Steering airbag module',sc,(.19,.13,.08),LEATHER,part,.042,'interior')
for side in [-1,1]:
    tube('Steering metallic spoke',[(-.478+side*.04,1.20,-.409),(-.478+side*.178,1.19,-.423)],.019,CHROME,part,'interior')
    for i in range(3):box('Steering multifunction button',(-.478+side*.127,1.205-i*.022,-.39),(.043,.012,.012),TRIM,part,.003,'interior')
tube('Lower steering spoke',[(-.478,1.18,-.412),(-.478,1.015,-.47)],.023,CHROME,part,'interior')
cyl('Steering column',(-.478,1.115,-.67),.045,.38,TRIM,part,axis=(0,.25,1),surface='interior')
for side in [-1,1]:tube('Indicator / wiper stalk',[(-.478+side*.03,1.16,-.56),(-.478+side*.265,1.19,-.57)],.012,TRIM,part,'interior')
# Console and detailed gear lever, twin cupholders, buttons, armrest.
box('Center tunnel console',(0,.678,.34),(.265,.27,1.05),LEATHER,'console',.055,'interior')
box('Shifter satin surround',(0,.824,-.065),(.233,.028,.28),CHROME,'console',.035,'interior')
box('Gear selector leather boot',(0,.853,-.08),(.125,.09,.17),TRIM,'console',.045,'interior')
cyl('Gear selector stem',(0,.948,-.08),.016,.13,CHROME,'console',axis=(0,1,0),surface='interior')
box('Gear selector grip',(0,1.004,-.095),(.09,.067,.077),LEATHER,'console',.027,'interior')
for z in [.27,.455]:
    cyl('Cupholder recess',(0,.812,z),.07,.02,TRIM,'console',axis=(0,1,0),surface='interior')
    torus('Cupholder chrome rim',(0,.825,z),.07,.005,CHROME,'console',axis=(0,1,0),surface='interior',segments=36)
box('Padded center armrest',(0,.86,.77),(.25,.13,.31),LEATHER,'console',.044,'interior')
for side in [-1,1]:tube('Console contrast stitching',[(side*.101,.926,z) for z in [.64,.68,.73,.78,.83,.88]],.002,THREAD,'console','interior')
# Belts at front and rear with upper anchors.
for x in [-.85,.85]:
  for z in [.23,1.40]:
    box('Upper belt anchor',(x,1.40,z),(.045,.068,.05),DARKMETAL,'belts',.015,'interior')
    pts=[(x,1.43,z),(x*.65,1.08,z-.23),(x*.36,.70,z-.26)]
    for dx in [-.015,0,.015]:tube('Seatbelt woven strap',[(p[0]+dx,p[1],p[2]) for p in pts],.009,BELT,'belts','interior')
    box('Belt receiver',(x*.36,.695,z-.25),(.036,.09,.05),TRIM,'belts',.012,'interior')
# Inspectable simplified engine bay: useful detail without tiny separately selectable mechanisms.
box('Boxer engine block',(0,.742,-1.52),(1.16,.31,.55),DARKMETAL,'engine',.055)
box('Engine top cover',(0,.938,-1.52),(.72,.07,.49),TRIM,'engine',.04)
for i in range(7):box('Engine cover cast rib',(-.26+i*.085,.982,-1.52),(.025,.022,.32),CHROME,'engine',.005)
box('Battery case',(-.62,.795,-1.39),(.27,.25,.39),TRIM,'engine',.025)
for z,m in [(-1.28,RED),(-1.49,DARKMETAL)]:box('Battery terminal',(-.62,.934,z),(.065,.035,.055),m,'engine',.008)
box('Air filter box',(.57,.795,-1.39),(.30,.20,.34),TRIM,'engine',.025)
tube('Air intake hose',[(.47,.81,-1.44),(.39,.89,-1.35),(.25,.94,-1.46)],.055,TRIM,'engine')
box('Radiator core',(0,.746,-1.964),(1.28,.36,.058),DARKMETAL,'engine',.015)
for i in range(26):box('Radiator fins',(-.59+i*.047,.749,-2.001),(.01,.28,.008),CHROME,'engine',.002)
cyl('Oil filler cap',(.255,.997,-1.55),.033,.017,AMBER,'engine',axis=(0,1,0),vertices=28)
box('Coolant expansion reservoir',(.62,.787,-1.87),(.19,.25,.17),HEADLIGHT,'engine',.025)
cyl('Coolant reservoir cap',(.62,.922,-1.87),.032,.025,TRIM,'engine',axis=(0,1,0),vertices=28)

# Apply modelling modifiers, convert curves, and merge per part/material/surface.
# Fine details stay geometry but do not become hundreds of draw calls in Three.js.
for part,objects in members.items():
    buckets=defaultdict(list)
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        if obj.type=='CURVE':bpy.ops.object.convert(target='MESH')
        for mod in list(obj.modifiers):
            try:bpy.ops.object.modifier_apply(modifier=mod.name)
            except RuntimeError:pass
        buckets[(obj.data.materials[0].name,obj.get('surface','exterior'))].append(obj)
    for (material_name,surface),objs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:obj.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1:bpy.ops.object.join()
        merged=bpy.context.object;merged.name=f'{part}__{material_name}__{surface}';merged['surface']=surface;merged['partId']=part
        matrix=merged.matrix_world.copy();merged.parent=parts[part];merged.matrix_world=matrix
        # Recalculate all normals on original manufactured surfaces.
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')

# Export only component roots and their descendants.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'subaru-xv-inspection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
# Stats are useful for automatic asset validation.
mesh_objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in mesh_objects)
metadata={'name':'Subaru XV GT Edition inspired inspection reference','license':'MIT; original geometry','exact_reconstruction':False,'authoring':'Blender '+bpy.app.version_string,'part_count':len(parts),'mesh_count':len(mesh_objects),'triangles':triangles,'parts':{name:{'pivot':list(pivots[name]),'meshes':len([o for o in mesh_objects if o.parent==parent])} for name,parent in parts.items()}}
(OUT/'model-metadata.json').write_text(json.dumps(metadata,indent=2))
# Studio scene is saved with the editable Blender file, excluded from GLB.
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.60,1);world.node_tree.nodes['Background'].inputs[1].default_value=.28
floor=box('Studio floor',(0,-.015,0),(200,.04,200),mat('Studio sage',(.32,.39,.34),0,.8),'underbody',0)
# Floor deliberately not parented: it belongs to studio only.
def area(name,pos,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=vec(pos);obj.rotation_euler=(vec((0,.8,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(2.8,5,-3),1100,5,(.93,1,.96));area('Rim softbox',(-3,3,2.8),1300,4,(.7,.85,1));area('Front fill',(-2,2,-4),650,3,(1,.91,.80))
camdata=bpy.data.cameras.new('Studio camera');cam=bpy.data.objects.new('Studio camera',camdata);bpy.context.collection.objects.link(cam);cam.location=vec((5.4,3.55,-6.7));cam.rotation_euler=(vec((0,.83,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=6.2;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'subaru-xv-studio.png')
# Save a convenient material-preview viewport in the Blender authoring artifact.
for screen in bpy.data.screens:
 for area_ in screen.areas:
  if area_.type=='VIEW_3D':
    area_.spaces.active.region_3d.view_distance=6.5;area_.spaces.active.region_3d.view_location=vec((0,.8,0));area_.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();area_.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
parts['left-front-door'].select_set(True);bpy.context.view_layer.objects.active=parts['left-front-door']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'modeling'/'subaru-xv-inspection.blend'))
print('MODEL_COMPLETE',json.dumps(metadata))
bpy.ops.render.render(write_still=True)
