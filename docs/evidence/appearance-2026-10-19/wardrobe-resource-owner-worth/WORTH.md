# Replaced-garment resource ownership — worth review

**B — no ownership correction or CPU experiment is justified by this packet.** The inspected normal replacement path already has deliberate cache and retirement owners. This is not a finding of universal leak freedom or measured GPU release.

Wardrobe:710–715 explicitly retains removed garments for reuse. #applyOutfit:808–823 detaches a departing mesh from the scene/worn map, while #fragmentFor:923–926 returns its existing cached/pending fragment on reuse. This is retained owned state, not a newly orphaned allocation on each outfit change. release:719–741 rejects worn/loading garments, retires interior and collected resources, then forgets an unworn fragment; dispose:750–765 retires cached as well as worn fragments.

The actual ownership boundaries differ from the skin-material case. #fragmentFor:930–944 captures geometry/material/texture/original-skeleton sets before adoption reparents and binds the mesh to the borrowed body skeleton. garmentResourcesOf/disposeGarmentResources:1091–1117 collect and dispose those sets, including imported texture properties. #adoptFragment:979–986 registers a returned replacement material before installing it. WardrobeStyles:71–81 borrows the original maps for that replacement, and :115–118 retires a failed local material allocation; it does not create the skin factory’s private texture set.

GarmentInterior:90–107 creates and registers cloned geometry/material while borrowing textures and the adopted skeleton. Its :76–86 disposal removes those clones from the shared sets and attempts both releases, avoiding duplicate ownership. Wardrobe invokes this owner before the remaining fragment resources. A load that arrives after disposal fails the live guard and goes through the resource catch at :936–945.

The authorized sixth file closes the normal host path: Avatar:2828 handles pending wardrobes; :2851 retires the current wardrobe before Figure disposal. swapFigure:3061–3087 tracks and retires stale/failed pending wardrobes, :3108 disposes the old owner before replacing the figure, and :3826–3830 delegates terminal wardrobe retirement. CatalogueDresser is a recipe chooser, not a resource owner; AvatarWardrobe:80–82 supplies the Wardrobe factory and styling options.

Two alternatives: retain the existing reusable cache, explicit release and host lifetime disposal, preserving the supported behavior but keeping unworn resources resident until their owner releases them; or deliberately change unworn-cache eviction policy to retire sooner, trading reuse/refetch behavior and requiring a separately demonstrated resource-budget need. The latter is a different policy, not a proved omitted-owner fix. I select retention; no successor is admitted.

I found no uniquely owned normal resource missing from the inspected retirement chain. Arbitrary injected loaders/factories, sharing outside the stated transfer contract, throwing disposal/listener paths, full loader/renderer internals and actual memory/physical release remain unqualified. No such hypothetical was promoted into an actionable defect.

All six source files were within the original cap; helpers/host were read only after exact shared addenda. Root’s prematurely recorded “sixth retired” statement and its explicit correction in HOST-INPUTS remain provenance, not an extra allowance or target retry. No seventh source or target ran.

Close this nomination without code, tests, probes or source preparation. Adopted skin ownership, preview utility, assets/defaults, closed methods, constructor HOLD and broad roadmap remain unchanged. pending_edits=false.
