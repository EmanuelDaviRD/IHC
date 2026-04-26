# TODO - Correção de Bugs

## app.js (frontend) ✅
- [x] Fix bindAllEvents() - broken cartIcon/favoritesIcon handlers, missing userBtn dropdown
- [x] Fix typo "renderCata" -> "renderCatalog"
- [x] Fix DOMContentLoaded - use loadLocalCartFavs() and checkAuthToken() instead of loadLocal()/checkAuth()
- [x] Add favoritesIcon onclick handler
- [x] Fix products-grid placement inside filters-bar HTML
- [x] Ensure all closing tags/divs are correct in renderCatalog HTML

## admin.html ✅
- [x] Close sidebar-header div properly

## admin.js ✅
- [x] Use p._id || p.id for MongoDB compatibility in edit/delete/dashboard
- [x] Use o._id || o.id and u._id || u.id for orders/customers
- [x] Add bulk delete for orders
- [x] Add status editing for orders
- [x] Complete missing functions (updatePreview, saveLayoutSettings, etc.)

## style.css ✅
- [x] Fix grid layout with justify-content: start and align-content: start
- [x] Add product-img-wrapper with aspect-ratio for consistent image sizing
- [x] Add flex: 1 to product-info for equal card heights
- [x] Improve hover effects with opacity transitions
- [x] Add heartPulse animation for favorite button
- [x] Fix product card height consistency with flexbox

## server.js (pending)
- [ ] Fix catch-all route to only serve index.html for non-API routes
- [ ] Fix PUT /produtos/:id to not pass undefined fields to Mongoose

