export interface IUserProfile{name:string;university:string;major:string;graduationYear:string;positionTagline:string;bio:string|null}
export const USER_PROFILE:IUserProfile={name:'姓名待补充',university:'河海大学',major:'广播电视学',graduationYear:'2027 届',positionTagline:'广播电视学 × AI 产品经理候选人',bio:'关注生成式 AI 如何提升选题策划、视听表达和采访后期的内容生产效率，能够独立完成需求分析、产品设计、前端开发、模型接入和内容验证。'};
export interface IMediaLensProject{id:string;title:string;topic:string;background:string;createdAt:number;updatedAt:number;result:IMediaLensResult|null}
export interface IMediaLensResult{value:string;audience:string;angles:string[];interviewees:{category:string;names:string[]}[];questions:{category:string;questions:string[]}[];knownFacts:string[];knownOpinions:string[];toVerify:string[];factChecklist:string[];platformTitles:{platform:string;titles:string[]}[]}
export interface IShotFlowProject{id:string;title:string;topic:string;platform:string;targetDuration:number;audience:string;contentType:string;style:string;sourceText?:string;material?:string;createdAt:number;updatedAt:number;shots:IShot[];versions:IVersion[]}
export interface IShot{id:string;shotNo?:number;shotNumber?:number;startTime?:number;duration:number;shotSize?:string;shotType?:string;camera?:string;cameraMovement?:string;description:string;action:string;voiceover?:string;narration?:string;subtitle:string;sound:string;transition:string;aiPrompt:string;locked:boolean}
export interface IVersion{id:string;name:string;savedAt?:number;createdAt?:number;shots:IShot[]}
export type IShotVersion=IVersion;
export interface IQuoteCutProject{id:string;title:string;transcript:string;sourceType:'text'|'srt';createdAt:number;updatedAt:number;segments:ISegment[];quotes:IQuote[];roughCut1min:IRoughCut;roughCut3min:IRoughCut;analysisDone:boolean}
export interface ISegment{id:string;topic:string;startTime:string;endTime:string;lines:ITranscriptLine[]}
export interface ITranscriptLine{id:string;time:string;text:string;speaker?:string}
export type QuoteCategory='fact'|'opinion'|'experience'|'emotion';
export interface IQuoteSegment{id:string;startTime:number;endTime:number;text:string;speaker?:string}
export interface IQuote{id:string;text:string;reason:string;category:QuoteCategory;startTime:number;endTime:number;segmentId:string;score?:number;segmentIndex?:number}
export interface IRoughCut{id?:string;name?:string;duration:number;clipIds:string[];narrativeNote:string;targetDuration?:number;actualDuration?:number;segmentIds?:string[];generatedAt?:number}
export const QUOTE_CATEGORY_LABELS:Record<QuoteCategory,string>={fact:'事实',opinion:'观点',experience:'经历',emotion:'情绪'};
