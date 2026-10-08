# [igl \|\  Interactive Geometry Lab](https://igl.ethz.ch/ "igl | Interactive Geometry Lab")

![ETH](https://igl.ethz.ch/includes/images/eth_logo_kurz.png)
Interactive

Geometry Lab


[ETH Zurich](https://www.ethz.ch/en.html "ETH Zürich")

## Robust Inside-Outside Segmentation using Generalized Winding Numbers

publication[ACM SIGGRAPH 2013](http://www.siggraph.org/s2013/)authors[Alec Jacobson](http://www.cs.toronto.edu/~jacobson/ "Alec Jacobson"),
[Ladislav Kavan](https://users.cs.utah.edu/~ladislav/ "Ladislav Kavan"),
[Olga Sorkine-Hornung](https://igl.ethz.ch/people/sorkine/ "Olga Sorkine-Hornung")award[SIGGRAPH Test-of-Time Award 2024](https://blog.siggraph.org/2024/06/siggraph-2024-technical-papers-awards-best-papers-honorable-mentions-and-test-of-time.html/)

[![A triangle mesh with thousands of artifacts is volume meshed with tets and then refined.](https://igl.ethz.ch/projects/winding-number/big-cat-teaser.jpg)](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-jacobson-et-al.pdf)

The _Big SigCat_ input mesh has 3442 pairs of intersecting triangles (bright red), 1020 edges on open boundaries (dark red), 344 non-manifold edges (purple) and 67 connected components (randomly colored). On top of those problems, a SIGGRAPH logo shaped hole is carved from her side.


### abstract

Solid shapes in computer graphics are often represented with
boundary descriptions, e.g. triangle meshes, but animation,
physically-based simulation, and geometry processing are more
realistic and accurate when explicit volume representations are
available. Tetrahedral meshes which exactly contain
(interpolate) the input boundary description are desirable but
difficult to construct for a large class of input meshes.
Character meshes and CAD models are often composed of many
connected components with numerous self-intersections,
non-manifold pieces, and open boundaries, precluding existing
meshing algorithms. We propose an automatic algorithm handling
all of these issues, resulting in a compact discretization of
the input’s inner volume. We only require reasonably consistent
orientation of the input triangle mesh. By generalizing the
winding number for arbitrary triangle meshes, we define a
function that is a perfect segmentation for watertight input
and is well-behaved otherwise. This function guides a graphcut
segmentation of a constrained Delaunay tessellation (CDT),
providing a minimal description that meets the boundary exactly
and may be fed as input to existing tools to achieve element
quality. We highlight our robustness on a number of examples
and show applications of solving PDEs, volumetric texturing and
elastic simulation.


### downloads

- [Paper](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-jacobson-et-al.pdf "Full resolution version: 30MB") (ACM SIGGRAPH 2013, official version available at [http://portal.acm.org/](http://portal.acm.org/ "ACM Digital Library"))
- [Paper (low resolution)](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-compressed-jacobson-et-al.pdf "Low resolution version: 991KB")
- [Slides](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-slides-jacobson-et-al.pdf "Full resolution version: 57MB")
- [Slides (low resolution)](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-slides-compressed-jacobson-et-al.pdf "Low resolution version: 9.7MB")
- [Supplemental Images (high resolution)](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-supplemental.pdf "15MB")
- [BibTex entry](https://igl.ethz.ch/publications/igl-bibtex.php#Jacobson:WN:2013)
- [Video](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers.mp4 "16MB")
- [Data](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers.zip "35MB")
- [MATLAB (+mex) Demo](https://igl.ethz.ch/projects/winding-number/winding_demo.zip "2.9MB")

### accompanying video

Robust Inside-Outside Segmentation using Generalized Winding Numbers - YouTube

Tap to unmute

[Robust Inside-Outside Segmentation using Generalized Winding Numbers](https://www.youtube.com/watch?v=v-Xeqj8AGGo) [Alec Jacobson](https://www.youtube.com/channel/UCB_w2ruAEd451wx8FoJZ9hQ)

Alec Jacobson1.24K subscribers

[Watch on](https://www.youtube.com/watch?v=v-Xeqj8AGGo)

[.mp4 raw video](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers.mp4 "16MB")

### fast forward

Robust Inside-Outside Segmentation using Generalized Winding Numbers Fast Forward SIGGRAPH 2013 - YouTube

Tap to unmute

[Robust Inside-Outside Segmentation using Generalized Winding Numbers Fast Forward SIGGRAPH 2013](https://www.youtube.com/watch?v=25quYrAozFk) [Alec Jacobson](https://www.youtube.com/channel/UCB_w2ruAEd451wx8FoJZ9hQ)

![thumbnail-image](https://yt3.ggpht.com/ytc/AIdro_mEPjAheHHKu6P7kCdYGHA3RTxsNNAHDCayt5oKnHRIrkI=s68-c-k-c0x00ffffff-no-rj)

Alec Jacobson1.24K subscribers

[Watch on](https://www.youtube.com/watch?v=25quYrAozFk)

### supplemental images and data

[![supplemental images](https://igl.ethz.ch/projects/winding-number/supplemental-images.png)](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-supplemental.pdf)

[.pdf with images](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-supplemental.pdf)

[.zip of meshes](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers.zip)

### winding\_demo\_2d.m MATLAB Demo

![2d demo](https://igl.ethz.ch/projects/winding-number/winding-demo-2d.jpg)

[MATLAB (+mex) Demo](https://igl.ethz.ch/projects/winding-number/winding_demo.zip "2.9MB")

### winding\_demo\_3d.m MATLAB Demo

![3d demo](https://igl.ethz.ch/projects/winding-number/winding-demo-3d.jpg)

[MATLAB (+mex) Demo](https://igl.ethz.ch/projects/winding-number/winding_demo.zip "2.9MB")

### updates & hindsights

Since writing the paper we've received a lot of great feedback. A
couple things have come to our attention.


The original publication had a typo in Equation (10), the
smoothness term for the graphcut. The _otherwise_ term read

$1 / (2 sigma^2) a\_{ij} \* exp( \| w(e\_i) - w(e\_j) \|^2 )$.

It
should have been

$1 / (2 sigma^2) a\_{ij} \* exp(-\| w(e\_i) -
w(e\_j) \|^2 )$.

The correct version penalizes assigning different
labels to elements with similar winding number—as a smoothness
term should. This is what's happening in our code and what's in our
PDF now.


The citation and account of "Visibility-driven mesh analysis and
visualization through graph cuts," by \[Zhou, Zhang, Bittner and\
Wonka 2008\] in our paper is misleading at best. We should have
written something more like, "The method of \[Zhou et al. 2008\] uses
ray-casting and graphcuts to assign inside/outside labels to each
side of triangles in an unoriented input mesh. The resulting
graphcut problem is potentially large and dense and requires
extensive parameter tuning and heuristics when dealing with
self-intersections and co-planar facets. Furthermore, fully or
nearly enclosed cavity regions require user intervention." A
comparison with this method would be very interesting, though
admittedly it is solving a harder problem since their input is
unoriented.


We write "This \[naive evaluation of the winding number\] is
embarrassingly parallel and the geometric definition invites the
possibility of a shader-style parallel implementation. However, the
asymptotic runtime would still grow linearly with the number of
input facets." While this true it doesn't tell the whole story: the
GPU is _very_ parallel and modern ones are quite fast. Martin
Bisson has [implemented the naive\\
method on the GPU](https://vimeo.com/72468198). According to some rough estimations, this
will beat the pants off our divide-and-conquer heirarchical
evaluation for input meshes smaller than 100,000 facets.

Rahul Narain has [posted\\
an alternative proof](http://r-to-the-n.tumblr.com/post/52752267384/the-harmonicity-of-the-generalized-winding-number) that the winding number is harmonic by reducing
the continuous integral to a well known formula from electrostatics.


Ibraheem ( _ennetws_) has wrapped our demo into a [Autodesk 3ds Max\\
script](http://www.scriptspot.com/3ds-max/scripts/mesh-fixing-tools).

### acknowledgments

We are indebted to Ilya Baran, Leo Guibas, Pierre Alliez, Alexander
Sorkine-Hornung and Daniele Panozzo for illuminating conversations. We are
grateful to Leonardo Koller Sacht, Fabian Hahn and Kaan Yücer for helping
create results. Thanks to Josef Pelikan for recognizing the practical
significance of winding numbers and including them in introductory computer
graphics classes. Thanks to the Pascal Frey and the University of Paris VI for
releasing the Medit software (used to visualize our 3D results) to the public
domain. Also, thanks to Marco Attene for making his MeshFix program open
source. This work was supported in part by the ERC grant iModel
(StG-2012-306877), by an SNF award 200021\_137879 and the Intel Doctoral
Fellowship.


* * *

©
[2026 ETH Zurich](http://www.ethz.ch/) \|
[Department of Computer Science](http://www.inf.ethz.ch/) \|
[Institute of Visual Computing](http://ivc.ethz.ch/) \|
[imprint](https://igl.ethz.ch/contact/) \|
Last update: Nov 19, 2024
