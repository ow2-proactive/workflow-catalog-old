/**
 * INSPINIA - Responsive Admin Theme
 *
 * Inspinia theme use AngularUI Router to manage routing and views
 * Each view are defined as state.
 * Initial there are written stat for all view in theme.
 *
 */
function config($stateProvider, $urlRouterProvider) {

    // HERE MAPPING URL <-> HTML
    // ALL HTML WILL BE REDIRECTED TO <div ui-view></div> in index.html (and attached css are defined there)
    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'views/login.html',
            authenticate: false
        })
        .state('index', {
            abstract: true,
            url: '/index',
            templateUrl: 'views/common/content.html',
            authenticate: true
        })
        .state('index.workflow_catalog', {
            url: '/workflow_catalog',
            templateUrl: 'views/workflow_catalog.html',
            authenticate: true,
            onEnter : function (WorkflowCatalogService){
            WorkflowCatalogService.startRegularWorkflowCatalogServiceQuery();
            },
            onExit: function($rootScope){
            $rootScope.$broadcast('event:StopRefreshing');
            }
        });
}

angular
    .module('inspinia')
    .config(config)
    .run(function ($rootScope, $state, $interval) {
        $rootScope.$state = $state;
        $rootScope.$interval = $interval;
    });

angular
    .module('inspinia')
    .config(function ($httpProvider) {
        $httpProvider.defaults.headers.common = {};
        $httpProvider.defaults.headers.post = {};
        $httpProvider.defaults.headers.put = {};
        $httpProvider.defaults.headers.patch = {};
        $httpProvider.defaults.headers.get = {};
        $httpProvider.defaults.useXDomain = true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];
    });

angular
    .module('inspinia')
    .run(function ($rootScope, $state, WorkflowCatalogService) {
        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            event.preventDefault();
            if (localStorage['pa.session'] == undefined) {
              //$rootScope.$broadcast('event:StopRefreshing');
                $state.go('login');
            } else {
                $state.go('index.workflow_catalog');
            }
        });
    });
