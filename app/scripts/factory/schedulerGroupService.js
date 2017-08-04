var wcpRestModule = angular.module('wcp-rest');

wcpRestModule.factory('schedulerGroupService', function ($http) {
    var groups = ["not init"];

    function updateGroupList() {
                var sessionid = getSessionId();
                console.log(sessionid);

                var userdata = $http.get(localStorage['schedulerRestUrl'] + 'logins/sessionid/' + sessionid + '/userdata/')

                var url = localStorage['schedulerRestUrl'] + 'logins/sessionid/' + sessionid + '/userdata/';
                $http.get(url)
                        .success(function (response) {
                             var groupsList = response.groups;
                             groupsList.unshift("");
                             groups = groupsList;
                        })
                        .error(function (response) {
                            console.error("Error while querying scheduling api on URL " + url + ":", JSON.stringify(response));
                        });


    }


    return {
            updateGroupList: function () {
                return updateGroupList();
            },
            getGroups: function() {
                return groups;
            }
        };
});
