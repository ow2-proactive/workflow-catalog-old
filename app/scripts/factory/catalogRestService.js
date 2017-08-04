var wcpRestModule = angular.module('wcp-rest');

wcpRestModule.factory('catalogRestService', function ($http) {

    var getUserData = function(successCallback) {
                var sessionid = getSessionId();

                var url = localStorage['schedulerRestUrl'] + 'logins/sessionid/' + sessionid + '/userdata/';
                $http.get(url)
                        .success(function (response) {
                            successCallback(response);
                        })
                        .error(function (response) {
                            console.error("Error while querying scheduling api on URL " + url + ":", JSON.stringify(response));
                        });
    }

    return {
            getUserData: getUserData
        };
});
