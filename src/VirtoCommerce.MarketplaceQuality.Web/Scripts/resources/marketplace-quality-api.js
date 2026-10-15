angular.module('VirtoCommerce.MarketplaceQuality')
    .factory('VirtoCommerce.MarketplaceQuality.webApi', ['$resource', function ($resource) {
        return $resource('api/marketplace-quality');
    }]);
