import WhiteboardMultiUser from '/imports/api/whiteboard-multi-user/';
import PresentationPods from '/imports/api/presentation-pods';
import Presentations from '/imports/api/presentations';
import { Slides, SlidePositions } from '/imports/api/slides';
import Users from '/imports/api/users';
import Auth from '/imports/ui/services/auth';

const getCurrentPresentation = podId => Presentations.findOne({
  podId,
  current: true,
});

const downloadPresentationUri = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);
  if (!currentPresentation) {
    return null;
  }

  const presentationFileName = `${currentPresentation.id}.${currentPresentation.name.split('.').pop()}`;

  const uri = `https://${window.document.location.hostname}/bigbluebutton/presentation/download/`
    + `${currentPresentation.meetingId}/${currentPresentation.id}`
    + `?presFilename=${encodeURIComponent(presentationFileName)}`;

  return uri;
};

const isPresentationDownloadable = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);
  if (!currentPresentation) {
    return null;
  }

  return currentPresentation.downloadable;
};

const getCurrentSlide = (podId) => {
  const currentPresentation = getCurrentPresentation(podId);

  if (!currentPresentation) {
    return null;
  }

  return Slides.findOne({
    podId,
    presentationId: currentPresentation.id,
    current: true,
  }, {
    fields: {
      meetingId: 0,
      thumbUri: 0,
      swfUri: 0,
      txtUri: 0,
    },
  });
};

const getSlidePosition = (podId, presentationId, slideId) => SlidePositions.findOne({
  podId,
  presentationId,
  id: slideId,
});

const currentSlidHasContent = () => {
  const currentSlide = getCurrentSlide('DEFAULT_PRESENTATION_POD');
  if (!currentSlide) return false;

  const {
    content,
  } = currentSlide;

  return !!content.length;
};

const parseCurrentSlideContent = (yesValue, noValue, abstentionValue, trueValue, falseValue) => {
  const currentSlide = getCurrentSlide('DEFAULT_PRESENTATION_POD');
  const quickPollOptions = [];
  if (!currentSlide) return quickPollOptions;

  let {
    content,
  } = currentSlide;

  const pollRegex = /[1-6A-Fa-f][.)].*/g;
  let optionsPoll = content.match(pollRegex) || [];
  if (optionsPoll) optionsPoll = optionsPoll.map(opt => `\r${opt[0]}.`);

  optionsPoll.reduce((acc, currentValue) => {
    const lastElement = acc[acc.length - 1];

    if (!lastElement) {
      acc.push({
        options: [currentValue],
      });
      return acc;
    }

    const {
      options,
    } = lastElement;

    const lastOption = options[options.length - 1];

    const isLastOptionInteger = !!parseInt(lastOption.charAt(1), 10);
    const isCurrentValueInteger = !!parseInt(currentValue.charAt(1), 10);

    if (isLastOptionInteger === isCurrentValueInteger) {
      if (currentValue.toLowerCase().charCodeAt(1) > lastOption.toLowerCase().charCodeAt(1)) {
        options.push(currentValue);
      } else {
        acc.push({
          options: [currentValue],
        });
      }
    } else {
      acc.push({
        options: [currentValue],
      });
    }
    return acc;
  }, []).filter(({
    options,
  }) => options.length > 1 && options.length < 7).forEach(poll => quickPollOptions.push({
    type: `A-${poll.options.length}`,
    poll,
  }));

  if (quickPollOptions.length > 0) {
    content = content.replace(new RegExp(pollRegex), '');
  }

  const ynPollString = `(${yesValue}\\s*\\/\\s*${noValue})|(${noValue}\\s*\\/\\s*${yesValue})`;
  const ynOptionsRegex = new RegExp(ynPollString, 'gi');
  const ynPoll = content.match(ynOptionsRegex) || [];

  const ynaPollString = `(${yesValue}\\s*\\/\\s*${noValue}\\s*\\/\\s*${abstentionValue})|(${yesValue}\\s*\\/\\s*${abstentionValue}\\s*\\/\\s*${noValue})|(${abstentionValue}\\s*\\/\\s*${yesValue}\\s*\\/\\s*${noValue})|(${abstentionValue}\\s*\\/\\s*${noValue}\\s*\\/\\s*${yesValue})|(${noValue}\\s*\\/\\s*${yesValue}\\s*\\/\\s*${abstentionValue})|(${noValue}\\s*\\/\\s*${abstentionValue}\\s*\\/\\s*${yesValue})`;
  const ynaOptionsRegex = new RegExp(ynaPollString, 'gi');
  const ynaPoll = content.match(ynaOptionsRegex) || [];

  const tfPollString = `(${trueValue}\\s*\\/\\s*${falseValue})|(${falseValue}\\s*\\/\\s*${trueValue})`;
  const tgOptionsRegex = new RegExp(tfPollString, 'gi');
  const tfPoll = content.match(tgOptionsRegex) || [];

  ynPoll.forEach(poll => quickPollOptions.push({
    type: 'YN',
    poll,
  }));

  ynaPoll.forEach(poll => quickPollOptions.push({
    type: 'YNA',
    poll,
  }));

  tfPoll.forEach(poll => quickPollOptions.push({
    type: 'TF',
    poll,
  }));

  return {
    slideId: currentSlide.id,
    quickPollOptions,
  };
};

const isPresenter = (podId) => {
  // a main presenter in the meeting always owns a default pod
  if (podId === 'DEFAULT_PRESENTATION_POD') {
    const options = {
      filter: {
        presenter: 1,
      },
    };
    const currentUser = Users.findOne({
      userId: Auth.userID,
    }, options);
    return currentUser ? currentUser.presenter : false;
  }

  // if a pod is not default, then we check whether this user owns a current pod
  const selector = {
    meetingId: Auth.meetingID,
    podId,
  };
  const pod = PresentationPods.findOne(selector);
  return pod.currentPresenterId === Auth.userID;
};

const getMultiUserStatus = (whiteboardId) => {
  const data = WhiteboardMultiUser.findOne({
    meetingId: Auth.meetingID,
    whiteboardId,
  });
  return data ? data.multiUser : false;
};

export default {
  getCurrentSlide,
  getSlidePosition,
  isPresenter,
  isPresentationDownloadable,
  downloadPresentationUri,
  getMultiUserStatus,
  currentSlidHasContent,
  parseCurrentSlideContent,
  getCurrentPresentation,
};
